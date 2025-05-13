"use client";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
  
  const getStepName = (step: number) => {
    switch(step) {
      case 1: return "Идея";
      case 2: return "Видение";
      case 3: return "Цели";
      case 4: return "Аудитория";
      case 5: return "Функции";
      case 6: return "Экспорт";
      default: return "";
    }
  }

  return (
    <div className="flex justify-between items-center mb-8 p-4 bg-card rounded-lg shadow">
      {steps.map((step) => (
        <div key={step} className="flex flex-col items-center text-center flex-1">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 transition-all duration-300",
              step < currentStep ? "bg-accent border-accent text-accent-foreground" : "",
              step === currentStep ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg" : "",
              step > currentStep ? "bg-muted border-muted-foreground text-muted-foreground" : ""
            )}
          >
            {step < currentStep ? '✔' : step}
          </div>
          <span className={cn(
            "text-xs font-medium",
            step === currentStep ? "text-primary font-semibold" : "text-muted-foreground"
          )}>
            {getStepName(step)}
          </span>
        </div>
      ))}
    </div>
  );
}
