"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateProductVision, GenerateProductVisionInput } from '@/ai/flows/generate-product-vision';
import { generateTechSpec, GenerateTechSpecInput } from '@/ai/flows/generate-tech-spec';
import { Loader2, ArrowLeft, ArrowRight, RefreshCw, Download } from 'lucide-react';
import StepIndicator from './StepIndicator';
import { exportToPdf } from '@/lib/pdfUtils';
import { Progress } from "@/components/ui/progress";


const TOTAL_STEPS = 6;

export default function VisionCraftWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [idea, setIdea] = useState('');
  const [productVision, setProductVision] = useState('');
  const [productGoals, setProductGoals] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [keyFeatures, setKeyFeatures] = useState('');
  const [techSpec, setTechSpec] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [progressValue, setProgressValue] = useState(0);

  useEffect(() => {
    setProgressValue(((currentStep -1) / (TOTAL_STEPS -1)) * 100);
  }, [currentStep]);


  const handleGenerateSuggestion = async (step: number) => {
    setIsLoading(true);
    try {
      let input: GenerateProductVisionInput;
      let promptText = '';
      let fieldToUpdate: (value: string) => void;

      switch (step) {
        case 2: // Product Vision
          promptText = `Сгенерируй видение продукта на основе следующей идеи: "${idea}"`;
          input = { idea: promptText };
          fieldToUpdate = setProductVision;
          break;
        case 3: // Product Goals
          promptText = `Ты опытный аналитик. На основе следующего видения продукта: "${productVision}", предложи цели продукта, оформи в виде пронумерованного списка. Сфокусируйся на целях в формулировке "продукт должен решать такую-то задачу"`;
          input = { idea: promptText };
          fieldToUpdate = setProductGoals;
          break;
        case 4: // Target Audience
          promptText = `Ты опытный исслудователь рынка. На основе видения продукта: "${productVision}" и целей: "${productGoals}", опиши целевую аудиторию. Представь в виде пронумерованного списка. `;
          input = { idea: promptText };
          fieldToUpdate = setTargetAudience;
          break;
        case 5: // Key Features
          promptText = `На основе видения: "${productVision}", целей: "${productGoals}", и аудитории: "${targetAudience}", предложи ключевые функции. Функционал опиши в виде "система будет иметь функционал:"`;
          input = { idea: promptText };
          fieldToUpdate = setKeyFeatures;
          break;
        default:
          setIsLoading(false);
          return;
      }

      const result = await generateProductVision(input);
      if (result.visionStatement) {
        fieldToUpdate(result.visionStatement);
        toast({ title: 'Успех', description: 'AI успешно сгенерировал предложение.' });
      } else {
        toast({ title: 'Ошибка', description: 'AI не смог сгенерировать предложение.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error generating suggestion:', error);
      toast({ title: 'Ошибка генерации', description: 'Произошла ошибка при обращении к AI.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTechSpec = async () => {
    setIsLoading(true);
    try {
      const productDetails = `
        Цели продукта: ${productGoals}
        Целевая аудитория: ${targetAudience}
        Ключевые функции: ${keyFeatures}
      `;
      const input: GenerateTechSpecInput = { productVision, productDetails };
      const result = await generateTechSpec(input);
      if (result.techSpec) {
        setTechSpec(result.techSpec);
        toast({ title: 'Успех', description: 'Техническое задание успешно сгенерировано.' });
      } else {
        toast({ title: 'Ошибка', description: 'AI не смог сгенерировать ТЗ.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error generating tech spec:', error);
      toast({ title: 'Ошибка генерации ТЗ', description: 'Произошла ошибка при обращении к AI.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !idea.trim()) {
      toast({ title: 'Ошибка', description: 'Пожалуйста, введите вашу идею.', variant: 'destructive' });
      return;
    }
    // Auto-generate suggestion for next step if applicable
    if (currentStep < TOTAL_STEPS -1 && currentStep > 0) { // Steps 2,3,4,5 need suggestions
        // Check if current field is empty before navigating to next step where it's a dependency
        if (currentStep === 1 && productVision.trim() === '') { /* Already handled by generate on step 2 entry */ }
        else if (currentStep === 2 && productGoals.trim() === '') { handleGenerateSuggestion(3); }
        else if (currentStep === 3 && targetAudience.trim() === '') { handleGenerateSuggestion(4); }
        else if (currentStep === 4 && keyFeatures.trim() === '') { handleGenerateSuggestion(5); }
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      // If moving to step 2, generate initial product vision
      if (currentStep + 1 === 2 && !productVision) {
        handleGenerateSuggestion(2);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePdfExport = () => {
    setIsLoading(true);
    const productData = { idea, productVision, productGoals, targetAudience, keyFeatures };
    try {
      exportToPdf(productData, techSpec, "VisionCraft_Документы");
      toast({ title: 'Экспорт успешно завершен', description: 'PDF файл был скачан.' });
    } catch (error) {
      console.error("PDF Export Error: ", error);
      toast({ title: 'Ошибка экспорта', description: 'Не удалось создать PDF файл.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Шаг 1: Ваша Идея</CardTitle>
              <CardDescription>Опишите вашу первоначальную идею продукта. Это основа для всего процесса.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="idea">Идея продукта</Label>
              <Textarea id="idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Например, платформа для обмена книгами..." rows={6} className="mt-1" />
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={handleNextStep} disabled={isLoading}>
                Далее <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        );
      case 2:
      case 3:
      case 4:
      case 5:
        const stepConfig = {
          2: { title: "Видение продукта", description: "AI предложил видение продукта. Отредактируйте и примите.", value: productVision, setter: setProductVision, rows: 6 },
          3: { title: "Цели продукта", description: "AI предложил цели. Отредактируйте и примите.", value: productGoals, setter: setProductGoals, rows: 4 },
          4: { title: "Целевая аудитория", description: "AI предложил описание аудитории. Отредактируйте и примите.", value: targetAudience, setter: setTargetAudience, rows: 4 },
          5: { title: "Ключевые функции", description: "AI предложил ключевые функции. Отредактируйте и примите.", value: keyFeatures, setter: setKeyFeatures, rows: 6 },
        }[currentStep];

        return (
          <Card>
            <CardHeader>
              <CardTitle>Шаг {currentStep}: {stepConfig.title}</CardTitle>
              <CardDescription>{stepConfig.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor={`step-${currentStep}-input`}>{stepConfig.title}</Label>
              <Textarea id={`step-${currentStep}-input`} value={stepConfig.value} onChange={(e) => stepConfig.setter(e.target.value)} placeholder={`Введите ${stepConfig.title.toLowerCase()}...`} rows={stepConfig.rows} className="mt-1" />
              <Button onClick={() => handleGenerateSuggestion(currentStep)} variant="outline" size="sm" className="mt-2" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Сгенерировать заново
              </Button>
            </CardContent>
            <CardFooter className="justify-between">
              <Button onClick={handlePreviousStep} variant="outline" disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Назад
              </Button>
              <Button onClick={handleNextStep} disabled={isLoading}>
                Далее <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        );
      case 6:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Шаг 6: Обзор и Экспорт</CardTitle>
              <CardDescription>Проверьте введенные данные и сгенерированное ТЗ. Затем экспортируйте все в PDF.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div id="product-card-content" className="space-y-4 p-4 border rounded-md bg-secondary/50">
                <h3 className="text-lg font-semibold text-primary">Карточка продукта</h3>
                <div><strong>Идея:</strong> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{idea}</p></div>
                <div><strong>Видение продукта:</strong> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{productVision}</p></div>
                <div><strong>Цели продукта:</strong> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{productGoals}</p></div>
                <div><strong>Целевая аудитория:</strong> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{targetAudience}</p></div>
                <div><strong>Ключевые функции:</strong> <p className="text-sm text-muted-foreground whitespace-pre-wrap">{keyFeatures}</p></div>
              </div>
              
              <div className="space-y-2">
                <Button onClick={handleGenerateTechSpec} variant="outline" className="w-full" disabled={isLoading || !productVision}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {techSpec ? 'Перегенерировать ТЗ' : 'Сгенерировать Техническое Задание'}
                </Button>
                {techSpec && (
                  <div id="tech-spec-content" className="p-4 border rounded-md bg-secondary/50">
                    <h3 className="text-lg font-semibold text-primary">Техническое Задание</h3>
                    <Textarea value={techSpec} readOnly rows={15} className="mt-1 bg-white text-sm whitespace-pre-wrap" />
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button onClick={handlePreviousStep} variant="outline" disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Назад
              </Button>
              <Button onClick={handlePdfExport} disabled={isLoading || !techSpec} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Экспорт в PDF
              </Button>
            </CardFooter>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      <Progress value={progressValue} className="w-full mb-8" />
      {renderStepContent()}
    </div>
  );
}
