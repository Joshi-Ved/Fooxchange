"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, Check } from "lucide-react";
import Image from "next/image";

interface CookModeProps {
    steps: {
        order: number;
        content: string;
        imageUrl: string | null;
    }[];
    recipeName: string;
}

export function CookMode({ steps, recipeName }: CookModeProps) {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    const handleStepComplete = (stepIndex: number) => {
        const newCompleted = new Set(completedSteps);
        if (completedSteps.has(stepIndex)) {
            newCompleted.delete(stepIndex);
        } else {
            newCompleted.add(stepIndex);
        }
        setCompletedSteps(newCompleted);

        // Auto-advance to next uncompleted step
        if (!completedSteps.has(stepIndex) && stepIndex < steps.length - 1) {
            setCurrentStep(stepIndex + 1);
        }
    };

    if (!isActive) {
        return (
            <Button
                size="lg"
                onClick={() => setIsActive(true)}
                className="gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-8 text-white hover:from-orange-600 hover:to-rose-600"
            >
                <ChefHat className="h-5 w-5" />
                Start Cook Mode
            </Button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
            {/* Header */}
            <div className="border-b bg-background/80 backdrop-blur-sm">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
                    <div>
                        <h2 className="text-xl font-bold">Cook Mode</h2>
                        <p className="text-sm text-muted-foreground">{recipeName}</p>
                    </div>
                    <Button variant="outline" onClick={() => setIsActive(false)}>
                        Exit
                    </Button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="border-b bg-muted/30 px-4 py-3">
                <div className="mx-auto max-w-4xl">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                            Step {currentStep + 1} of {steps.length}
                        </span>
                        <span>
                            {completedSteps.size} / {steps.length} completed
                        </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-300"
                            style={{
                                width: `${(completedSteps.size / steps.length) * 100}%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-4 py-8">
                <div className="mx-auto max-w-4xl space-y-6">
                    {steps.map((step, index) => {
                        const isCompleted = completedSteps.has(index);
                        const isCurrent = currentStep === index;

                        return (
                            <Card
                                key={step.order}
                                className={`transition-all ${isCurrent
                                        ? "ring-2 ring-orange-500 shadow-lg"
                                        : isCompleted
                                            ? "opacity-70"
                                            : "opacity-50"
                                    }`}
                            >
                                <CardContent className="p-6">
                                    <div className="flex gap-4">
                                        {/* Step Number */}
                                        <div className="flex-shrink-0">
                                            <div
                                                className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${isCompleted
                                                        ? "bg-green-500 text-white"
                                                        : isCurrent
                                                            ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white"
                                                            : "bg-muted text-muted-foreground"
                                                    }`}
                                            >
                                                {isCompleted ? (
                                                    <Check className="h-6 w-6" />
                                                ) : (
                                                    step.order
                                                )}
                                            </div>
                                        </div>

                                        {/* Step Content */}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <p
                                                        className={`text-lg leading-relaxed ${isCompleted
                                                                ? "line-through text-muted-foreground"
                                                                : ""
                                                            }`}
                                                    >
                                                        {step.content}
                                                    </p>
                                                </div>
                                                {step.imageUrl && (
                                                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
                                                        <Image
                                                            src={step.imageUrl}
                                                            alt={`Step ${step.order}`}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Complete Button */}
                                            <Button
                                                variant={isCompleted ? "outline" : "default"}
                                                className="mt-4"
                                                onClick={() => handleStepComplete(index)}
                                            >
                                                {isCompleted ? "Undo" : "Mark Complete"}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Completion Message */}
                    {completedSteps.size === steps.length && (
                        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
                            <CardContent className="p-6 text-center">
                                <div className="mb-2 text-4xl">🎉</div>
                                <h3 className="text-xl font-bold text-green-700 dark:text-green-400">
                                    Recipe Complete!
                                </h3>
                                <p className="mt-2 text-muted-foreground">
                                    Congratulations on cooking {recipeName}
                                </p>
                                <Button
                                    className="mt-4"
                                    onClick={() => {
                                        setIsActive(false);
                                        setCompletedSteps(new Set());
                                        setCurrentStep(0);
                                    }}
                                >
                                    Exit Cook Mode
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Bottom Navigation */}
            <div className="border-t bg-background/80 px-4 py-4 backdrop-blur-sm">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <Button
                        variant="outline"
                        disabled={currentStep === 0}
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    >
                        Previous
                    </Button>
                    <Button
                        disabled={currentStep === steps.length - 1}
                        onClick={() =>
                            setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
                        }
                    >
                        Next Step
                    </Button>
                </div>
            </div>
        </div>
    );
}
