#!/bin/bash
# =============================================================
# Fooxchange AWS Deployment Script
# Supports: ECS Fargate, App Runner, Elastic Beanstalk
# =============================================================

set -euo pipefail

# Configuration - override via environment or edit here
AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
ECR_REPO="fooxchange"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# -----------------------------------------------------------
# Step 1: Create ECR Repository (if it doesn't exist)
# -----------------------------------------------------------
setup_ecr() {
    log "Setting up ECR repository: ${ECR_REPO}..."
    aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${AWS_REGION}" 2>/dev/null || \
    aws ecr create-repository \
        --repository-name "${ECR_REPO}" \
        --region "${AWS_REGION}" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    log "ECR repository ready."
}

# -----------------------------------------------------------
# Step 2: Build & Push Docker Image
# -----------------------------------------------------------
build_and_push() {
    log "Logging in to ECR..."
    aws ecr get-login-password --region "${AWS_REGION}" | \
        docker login --username AWS --password-stdin "${ECR_URI}"

    log "Building Docker image..."
    docker build -t "${ECR_REPO}:${IMAGE_TAG}" .

    log "Tagging image..."
    docker tag "${ECR_REPO}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
    docker tag "${ECR_REPO}:${IMAGE_TAG}" "${ECR_URI}:latest"

    log "Pushing to ECR..."
    docker push "${ECR_URI}:${IMAGE_TAG}"
    docker push "${ECR_URI}:latest"

    log "Image pushed: ${ECR_URI}:${IMAGE_TAG}"
}

# -----------------------------------------------------------
# Step 3: Store Secrets in SSM Parameter Store
# -----------------------------------------------------------
setup_secrets() {
    log "Storing secrets in SSM Parameter Store..."

    if [ ! -f .env ]; then
        error ".env file not found. Copy .env.example to .env and fill in values."
    fi

    # Read .env and push each var to SSM
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        # Remove surrounding quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//')

        aws ssm put-parameter \
            --name "/fooxchange/${key}" \
            --value "${value}" \
            --type "SecureString" \
            --overwrite \
            --region "${AWS_REGION}" 2>/dev/null && \
            log "  Set /fooxchange/${key}" || \
            warn "  Failed to set /fooxchange/${key}"
    done < .env

    log "Secrets stored in SSM."
}

# -----------------------------------------------------------
# Step 4: Create ECS Cluster & Service
# -----------------------------------------------------------
deploy_ecs() {
    local CLUSTER="fooxchange-cluster"
    local SERVICE="fooxchange-service"
    local TASK_FAMILY="fooxchange"

    # Create cluster if needed
    log "Ensuring ECS cluster exists..."
    aws ecs describe-clusters --clusters "${CLUSTER}" --region "${AWS_REGION}" 2>/dev/null | \
        grep -q "ACTIVE" || \
    aws ecs create-cluster --cluster-name "${CLUSTER}" --region "${AWS_REGION}" \
        --capacity-providers FARGATE --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1

    # Register task definition
    log "Registering task definition..."
    local TASK_DEF=$(cat aws/task-definition.json | \
        sed "s/ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" | \
        sed "s/REGION/${AWS_REGION}/g")
    echo "${TASK_DEF}" | aws ecs register-task-definition --cli-input-json file:///dev/stdin --region "${AWS_REGION}"

    # Check if service exists, update or create
    if aws ecs describe-services --cluster "${CLUSTER}" --services "${SERVICE}" --region "${AWS_REGION}" 2>/dev/null | grep -q "ACTIVE"; then
        log "Updating ECS service..."
        aws ecs update-service \
            --cluster "${CLUSTER}" \
            --service "${SERVICE}" \
            --task-definition "${TASK_FAMILY}" \
            --force-new-deployment \
            --region "${AWS_REGION}"
    else
        log "Creating ECS service..."
        warn "You need to provide a subnet and security group. Edit this command or use the AWS Console."
        echo ""
        echo "  aws ecs create-service \\"
        echo "    --cluster ${CLUSTER} \\"
        echo "    --service-name ${SERVICE} \\"
        echo "    --task-definition ${TASK_FAMILY} \\"
        echo "    --desired-count 1 \\"
        echo "    --launch-type FARGATE \\"
        echo "    --network-configuration 'awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}' \\"
        echo "    --region ${AWS_REGION}"
        echo ""
    fi

    log "ECS deployment complete."
}

# -----------------------------------------------------------
# Step 5: Deploy to App Runner (simpler alternative)
# -----------------------------------------------------------
deploy_apprunner() {
    local SERVICE_NAME="fooxchange"

    log "Deploying to AWS App Runner..."

    # Check if service exists
    local SERVICE_ARN=$(aws apprunner list-services --region "${AWS_REGION}" 2>/dev/null | \
        grep -o "arn:aws:apprunner:${AWS_REGION}:${AWS_ACCOUNT_ID}:service/${SERVICE_NAME}/[a-z0-9]*" | head -1)

    if [ -n "${SERVICE_ARN}" ]; then
        log "Updating existing App Runner service..."
        aws apprunner update-service \
            --service-arn "${SERVICE_ARN}" \
            --source-configuration "{
                \"ImageRepository\": {
                    \"ImageIdentifier\": \"${ECR_URI}:latest\",
                    \"ImageRepositoryType\": \"ECR\",
                    \"ImageConfiguration\": {
                        \"Port\": \"3000\",
                        \"RuntimeEnvironmentVariables\": {
                            \"NODE_ENV\": \"production\",
                            \"HOSTNAME\": \"0.0.0.0\"
                        }
                    }
                },
                \"AutoDeploymentsEnabled\": true
            }" \
            --region "${AWS_REGION}"
    else
        log "Creating new App Runner service..."
        warn "You need an IAM access role for ECR. Create one first or use the AWS Console."
        echo ""
        echo "See: https://docs.aws.amazon.com/apprunner/latest/dg/service-source-image.html"
        echo ""
    fi
}

# -----------------------------------------------------------
# Main
# -----------------------------------------------------------
usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup       - Create ECR repo + store secrets in SSM"
    echo "  build       - Build & push Docker image to ECR"
    echo "  deploy-ecs  - Deploy to ECS Fargate"
    echo "  deploy-app  - Deploy to App Runner"
    echo "  full        - Run everything (setup + build + deploy-ecs)"
    echo ""
}

case "${1:-}" in
    setup)
        setup_ecr
        setup_secrets
        ;;
    build)
        build_and_push
        ;;
    deploy-ecs)
        deploy_ecs
        ;;
    deploy-app)
        deploy_apprunner
        ;;
    full)
        setup_ecr
        setup_secrets
        build_and_push
        deploy_ecs
        ;;
    *)
        usage
        exit 1
        ;;
esac

log "Done!"
