'use server';
/**
 * @fileOverview Generates a credit agreement disposition card with detailed financial and legal attributes.
 *
 * - generateCreditDisposition - Function to handle credit disposition generation.
 * - GenerateCreditDispositionInput - Input type for the function.
 * - GenerateCreditDispositionOutput - Output type for the function.
 * - CreditDispositionCardData - The type for the disposition card data.
 * - SublimitDetail - Type for individual sublimit details.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const GenerateCreditDispositionInputSchema = z.object({
  documentDataUri: z
    .string()
    .describe(
      "The credit agreement PDF document as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
  fileName: z.string().optional().describe('The original name of the PDF file.'),
});
export type GenerateCreditDispositionInput = z.infer<typeof GenerateCreditDispositionInputSchema>;

// Schema for individual sublimit details
const SublimitDetailSchema = z.object({
  sublimitAmount: z.coerce.number().optional().nullable().describe("Сумма сублимита (только числовое значение, например 500000). Искать в разделах о сублимитах или условиях кредитной линии."),
  sublimitCurrency: z.string().optional().describe("Валюта сублимита (например, RUB, USD). Обычно указывается рядом с суммой сублимита."),
  sublimitAvailabilityPeriod: z.string().optional().describe("Период доступности сублимита (например, 'до 31.12.2025', 'В течение 6 месяцев с даты выдачи'). Искать в условиях предоставления сублимита."),
  sublimitExpiryDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe("Дата завершения действия сублимита (ГГГГ-ММ-ДД). Искать в условиях действия сублимита."),
  sublimitPurpose: z.string().optional().describe("Цели, на которые выделялся сублимит (например, 'Пополнение оборотных средств', 'Приобретение оборудования'). Искать в описании сублимита или целевом назначении кредита."),
  sublimitInvestmentPhase: z.string().optional().describe("Инвестиционная фаза сублимита (например, 'Инвестиционная', 'Операционная'). Может быть указано в описании цели сублимита."),
  sublimitRepaymentOrder: z.string().optional().describe("Особенности порядка погашения задолженности по сублимиту (например, 'Погашение после основного долга', 'Аннуитетные платежи'). Искать в условиях погашения сублимита."),
});
export type SublimitDetail = z.infer<typeof SublimitDetailSchema>;

// Zod schema for the disposition card for AI guidance
const CreditDispositionCardZodSchema = z.object({
  // Общие элементы
  statementNumber: z.string().optional().describe('Уникальный идентификатор заявки (Номер заявления в кредитной дороге). Может отсутствовать в самом договоре, чаще это внутренний номер банка.'),
  statementDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe('Дата заявления (ГГГГ-ММ-ДД). Также может отсутствовать в договоре.'),
  borrowerName: z.string().optional().describe('Полное юридическое название заемщика. Искать в преамбуле или разделе "Стороны договора".'),
  borrowerInn: z.string().optional().describe('ИНН заемщика. Искать в реквизитах сторон или приложении к договору.'),
  contractNumber: z.string().optional().describe('Номер подписанного кредитного договора. Обычно в шапке документа или преамбуле.'),
  contractDate: z.union([z.date().nullable(), z.string().optional()]).optional().describe('Дата подписания договора (ГГГГ-ММ-ДД). Обычно рядом с номером договора.'),
  creditType: z.enum(['Кредитная линия', 'Возобновляемая кредитная линия']).optional().describe('Тип кредита (выбрать из: "Кредитная линия", "Возобновляемая кредитная линия"). Искать в названии договора или разделе "Предмет договора".'),
  limitCurrency: z.string().optional().describe('Валюта кредитного лимита/общей суммы договора (например, RUB, USD). Обычно указывается рядом с суммой.'),
  contractAmount: z.coerce.number().optional().nullable().describe(
    'ОБЯЗАТЕЛЬНО ИЗВЛЕЧЬ! Общая сумма кредита/договора или установленный лимит кредитования. Ищите это значение в разделах, описывающих финансовые условия, сумму кредита, лимит кредитной линии. Часто обозначается как "Сумма Договора", "Лимит Кредитования", "Сумма кредита составляет". Извлеките ТОЛЬКО ЧИСЛОВОЕ ЗНАЧЕНИЕ (например, 1500000.75), без текста, валюты или разделителей тысяч. Если не найдено, оставьте поле пустым, но постарайтесь найти.'
  ),
  bankUnitCode: z.string().optional().describe('Код подразделения банка, в котором обслуживается заемщик. Может быть указан в реквизитах банка.'),
  contractTerm: z.string().optional().describe('Срок действия договора (например, "36 месяцев", "до ДД.ММ.ГГГГ"). Искать в разделе "Срок действия договора" или "Основные условия".'),
  borrowerAccountNumber: z.string().optional().describe('Банковский расчётный счёт заемщика. Искать в реквизитах заемщика.'),
  enterpriseCategory: z.enum(['Среднее', 'Малое', 'Микро', 'Не применимо']).optional().describe('Признак субъекта МСП (выбрать из: "Среднее", "Малое", "Микро", "Не применимо"). Может быть указано в преамбуле или специальном разделе о заемщике.'),
  creditCommitteeDecisionDetails: z.string().optional().describe('Детали решения кредитного комитета (например, номер протокола, дата). Если просто "да/нет", указать "Решение принято" или "Решение отсутствует". Обычно это ссылка на отдельный документ.'),
  subsidyAgent: z.string().optional().describe('Организация, предоставляющая субсидии, если это применимо к договору. Искать упоминания субсидий.'),
  generalNotesAndSpecialConditions: z.string().optional().describe('Общие дополнительные примечания и особые условия (например, наличие субсидий, льготных ставок, ковенанты). Искать в разделах "Особые условия", "Дополнительные условия".'),

  // Элементы, специфичные для бухгалтерского учета по стандартам МСФО
  sppiTestResult: z.string().optional().describe('Результат SPPI-теста (например, "Пройден успешно", "Не пройден", "Соответствует критериям SPPI"). Обычно это внутренняя оценка банка, может отсутствовать в договоре.'),
  assetOwnershipBusinessModel: z.enum(['Удерживать для продажи', 'Удерживать для получения денежных потоков', 'Иное']).optional().describe('Бизнес-модель владения активом (выбрать из: "Удерживать для продажи", "Удерживать для получения денежных потоков", "Иное"). Также внутренняя оценка.'),
  marketTransactionAssessment: z.enum(['Рыночная', 'Нерыночная', 'Не удалось определить']).optional().describe('Оценка рыночности сделки (рыночной стоимости договора) (выбрать из: "Рыночная", "Нерыночная", "Не удалось определить"). Внутренняя оценка.'),

  // Комиссионные сборы по договору
  commissionType: z.enum(["Фиксированная", "Переменная", "Отсутствует", "Комбинированная"]).optional().describe("Вид комиссии (выбрать из: \"Фиксированная\", \"Переменная\", \"Отсутствует\", \"Комбинированная\"). Искать в разделе о комиссиях или тарифах."),
  commissionCalculationMethod: z.string().optional().describe("Порядок расчета сумм комиссий (алгоритм вычисления или конкретные цифры, например '0.5% от суммы выдачи', '10000 RUB единовременно'). Искать в разделе о комиссиях."),
  commissionPaymentSchedule: z.array(z.union([z.date(), z.string()])).optional().describe("Графики платежей комиссий (массив дат в формате ГГГГ-ММ-ДД или текстовых описаний сроков). Искать в условиях оплаты комиссий."),
  
  // Условия досрочного погашения
  earlyRepaymentConditions: z.object({
    mandatoryEarlyRepaymentAllowed: z.boolean().optional().describe("Возможность обязательного досрочного погашения (true/false). Искать в разделе 'Досрочное погашение'."),
    voluntaryEarlyRepaymentAllowed: z.boolean().optional().describe("Возможность добровольного досрочного погашения (true/false). Искать там же."),
    earlyRepaymentFundingSources: z.string().optional().describe("Источники финансирования досрочных выплат (например, 'Собственные средства Заемщика', 'Рефинансирование'). Указывается в условиях досрочного погашения."),
    earlyRepaymentCommissionRate: z.coerce.number().optional().nullable().describe("Размер комиссий за досрочные выплаты (в процентах, только числовое значение, например 1.5). Искать в условиях досрочного погашения."),
    principalAndInterestRepaymentOrder: z.string().optional().describe("Очередность погашения основного долга и процентов при досрочном погашении (например, 'Сначала проценты, затем основной долг'). Искать в условиях досрочного погашения."),
    earlyRepaymentMoratoriumDetails: z.string().optional().describe("Ограничительные моратории на возможность досрочно погасить долг (описание условий или \"Отсутствует\"). Искать в условиях досрочного погашения."),
  }).optional().describe("Детали условий досрочного погашения. Если раздел отсутствует, этот объект можно опустить."),

  // Штрафные санкции за просрочку платежа
  penaltySanctions: z.object({
    latePrincipalPaymentPenalty: z.string().optional().describe("Размеры штрафов за несвоевременную оплату основной части займа (например, \"0.1% в день от суммы просрочки\", \"Фиксированная сумма 5000 RUB\"). Искать в разделе 'Ответственность сторон' или 'Штрафные санкции'."),
    lateInterestPaymentPenalty: z.string().optional().describe("Размеры санкций за задержку оплаты начисленных процентов (например, \"Аналогично штрафу за просрочку ОД\"). Искать там же."),
    lateCommissionPaymentPenalty: z.string().optional().describe("Штрафы за неоплату комиссий (например, \"0.05% в день от суммы неоплаченной комиссии\"). Искать там же."),
    penaltyIndexation: z.boolean().optional().describe('Применяется ли увеличение размера неустойки (true/false). Искать в условиях о штрафах.'),
  }).optional().describe("Детали штрафных санкций. Если раздел отсутствует, этот объект можно опустить."),

  // Информация по сублимитам
  sublimitDetails: z.array(SublimitDetailSchema).optional().describe("Массив объектов с детальной информацией по каждому сублимиту. Если сублимиты не найдены, оставить пустым массивом."),

  // Дополнительные финансовые показатели и регламенты расчетов
  financialIndicatorsAndCalculations: z.object({
    accruedInterestRate: z.coerce.number().optional().nullable().describe("Процентные ставки для начисленных процентов (число, например, 12.5 для 12.5%). Искать в разделе 'Процентная ставка'."),
    capitalizedInterestRate: z.coerce.number().optional().nullable().describe("Процентные ставки для капитализированных процентов (число, например 0.5). Искать в условиях о капитализации процентов, если есть."),
    accruedInterestCalculationRules: z.string().optional().describe("Правила и алгоритмы расчета начисленных процентов (например, 'На остаток основного долга', 'Формула X'). Искать в разделе о порядке начисления процентов."),
    interestPaymentRegulations: z.string().optional().describe("Регламент уплат процентов (например, 'Ежемесячно, не позднее 5-го числа', 'В конце срока'). Искать в разделе о порядке уплаты процентов."),
    debtAndCommissionReservingParams: z.string().optional().describe("Параметры резервирования по долгу и комиссиям (например, 'Согласно Положению ЦБ РФ № XXX'). Обычно это внутренняя информация банка, может отсутствовать в договоре."),
    insuranceProductCodes: z.string().optional().describe("Специфические коды страховых продуктов, если применимо. Искать упоминания страхования в договоре."),
    specialContractConditions: z.string().optional().describe("Особые условия договора, относящиеся к финансовым расчетам, не вошедшие в другие поля."),
  }).optional().describe("Финансовые показатели и регламенты. Если раздел отсутствует, этот объект можно опустить."),

  // Административные блоки
  finalCreditQualityCategory: z.enum(['Хорошее', 'Проблемное', 'Просроченное', 'Не определена']).optional().describe('Итоговая категория качества кредита (соответствие нормам ЦБ) (выбрать из: "Хорошее", "Проблемное", "Просроченное", "Не определена"). Обычно это внутренняя оценка банка.'),
  dispositionExecutorName: z.string().optional().describe('ФИО сотрудника, подготовившего распоряжение. Это поле заполняется пользователем сервиса, а не извлекается из договора.'),
  authorizedSignatory: z.string().optional().describe('Лицо, имеющее полномочия подписи от банка (ФИО). Может быть указано в преамбуле или реквизитах банка.'),
});
export type CreditDispositionCardData = z.infer<typeof CreditDispositionCardZodSchema>;


const GenerateCreditDispositionOutputSchema = z.object({
  dispositionCard: CreditDispositionCardZodSchema,
});
export type GenerateCreditDispositionOutput = z.infer<typeof GenerateCreditDispositionOutputSchema>;


export async function generateCreditDisposition(input: GenerateCreditDispositionInput): Promise<GenerateCreditDispositionOutput> {
  return generateCreditDispositionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCreditDispositionPrompt',
  input: { schema: GenerateCreditDispositionInputSchema },
  output: { schema: GenerateCreditDispositionOutputSchema },
  prompt: `Вы — AI-ассистент, высококвалифицированный юрист-аналитик, специализирующийся на детальном разборе кредитных договоров на русском языке.
Ваша задача — тщательно проанализировать предоставленный PDF-документ кредитного договора и извлечь всю возможную информацию для формирования "Распоряжения о постановке на учет".

Внимательно проанализируйте весь документ. Если какой-либо атрибут из перечисленных ниже отсутствует в договоре или не может быть однозначно определен, оставьте соответствующее поле в JSON-выводе пустым или со значением по умолчанию, как это предусмотрено схемой (например, false для boolean, пустой массив для массивов дат/объектов, undefined или null для опциональных полей). Не придумывайте информацию, если ее нет в документе.
Для числовых полей возвращайте только числовое значение (например, 1500000.75), без текста, символов валют или разделителей тысяч.
Для дат используйте формат ГГГГ-ММ-ДД.

Документ для анализа (кредитный договор в формате PDF):
{{media url=documentDataUri}}

{{#if fileName}}
Имя файла (для контекста): {{{fileName}}}
{{/if}}

Извлеките следующие данные для dispositionCard:

**Общие элементы:**
- statementNumber: Уникальный идентификатор заявки (Номер заявления в кредитной дороге). Может отсутствовать в самом договоре, чаще это внутренний номер банка.
- statementDate: Дата заявления (ГГГГ-ММ-ДД). Также может отсутствовать в договоре.
- borrowerName: Полное юридическое название заемщика. Искать в преамбуле или разделе "Стороны договора".
- borrowerInn: ИНН заемщика. Искать в реквизитах сторон или приложении к договору.
- contractNumber: Номер подписанного кредитного договора. Обычно в шапке документа или преамбуле.
- contractDate: Дата подписания договора (ГГГГ-ММ-ДД). Обычно рядом с номером договора.
- creditType: Тип кредита (выбрать из: "Кредитная линия", "Возобновляемая кредитная линия"). Искать в названии договора или разделе "Предмет договора".
- limitCurrency: Валюта кредитного лимита/общей суммы договора (например, RUB, USD). Обычно указывается рядом с суммой.
- contractAmount: ОБЯЗАТЕЛЬНО ИЗВЛЕЧЬ! Общая сумма кредита/договора или установленный лимит кредитования. Ищите это значение в разделах, описывающих финансовые условия, сумму кредита, лимит кредитной линии. Часто обозначается как "Сумма Договора", "Лимит Кредитования", "Сумма кредита составляет". Извлеките ТОЛЬКО ЧИСЛОВОЕ ЗНАЧЕНИЕ (например, 1500000.75), без текста, валюты или разделителей тысяч. Если не найдено, оставьте поле пустым, но постарайтесь найти.
- bankUnitCode: Код подразделения банка, в котором обслуживается заемщик. Может быть указан в реквизитах банка.
- contractTerm: Срок действия договора (например, "36 месяцев", "до ДД.ММ.ГГГГ"). Искать в разделе "Срок действия договора" или "Основные условия".
- borrowerAccountNumber: Банковский расчётный счёт заемщика. Искать в реквизитах заемщика.
- enterpriseCategory: Признак субъекта МСП (выбрать из: "Среднее", "Малое", "Микро", "Не применимо"). Может быть указано в преамбуле или специальном разделе о заемщике.
- creditCommitteeDecisionDetails: Детали решения кредитного комитета (например, номер протокола, дата). Если просто "да/нет", указать "Решение принято" или "Решение отсутствует". Обычно это ссылка на отдельный документ.
- subsidyAgent: Организация, предоставляющая субсидии, если это применимо к договору. Искать упоминания субсидий.
- generalNotesAndSpecialConditions: Общие дополнительные примечания и особые условия (например, наличие субсидий, льготных ставок, ковенанты). Искать в разделах "Особые условия", "Дополнительные условия".

**Элементы для МСФО:**
- sppiTestResult: Результат SPPI-теста (например, "Пройден успешно", "Не пройден", "Соответствует критериям SPPI"). Обычно это внутренняя оценка банка, может отсутствовать в договоре.
- assetOwnershipBusinessModel: Бизнес-модель владения активом (выбрать из: "Удерживать для продажи", "Удерживать для получения денежных потоков", "Иное"). Также внутренняя оценка.
- marketTransactionAssessment: Оценка рыночности сделки (рыночной стоимости договора) (выбрать из: "Рыночная", "Нерыночная", "Не удалось определить"). Внутренняя оценка.

**Комиссионные сборы:**
- commissionType: Вид комиссии (выбрать из: "Фиксированная", "Переменная", "Отсутствует", "Комбинированная"). Искать в разделе о комиссиях или тарифах.
- commissionCalculationMethod: Порядок расчета сумм комиссий (алгоритм вычисления или конкретные цифры, например '0.5% от суммы выдачи', '10000 RUB единовременно'). Искать в разделе о комиссиях.
- commissionPaymentSchedule: Графики платежей комиссий (массив дат в формате ГГГГ-ММ-ДД или текстовых описаний сроков). Искать в условиях оплаты комиссий.

**Условия досрочного погашения (объект earlyRepaymentConditions):**
- mandatoryEarlyRepaymentAllowed: Возможность обязательного досрочного погашения (true/false). Искать в разделе 'Досрочное погашение'.
- voluntaryEarlyRepaymentAllowed: Возможность добровольного досрочного погашения (true/false). Искать там же.
- earlyRepaymentFundingSources: Источники финансирования досрочных выплат (например, 'Собственные средства Заемщика', 'Рефинансирование'). Указывается в условиях досрочного погашения.
- earlyRepaymentCommissionRate: Размер комиссий за досрочные выплаты (в процентах, только числовое значение, например 1.5). Искать в условиях досрочного погашения.
- principalAndInterestRepaymentOrder: Очередность погашения основного долга и процентов при досрочном погашении (например, 'Сначала проценты, затем основной долг'). Искать в условиях досрочного погашения.
- earlyRepaymentMoratoriumDetails: Ограничительные моратории на возможность досрочно погасить долг (описание условий или "Отсутствует"). Искать в условиях досрочного погашения.

**Штрафные санкции (объект penaltySanctions):**
- latePrincipalPaymentPenalty: Размеры штрафов за несвоевременную оплату основной части займа (например, "0.1% в день от суммы просрочки", "Фиксированная сумма 5000 RUB"). Искать в разделе 'Ответственность сторон' или 'Штрафные санкции'.
- lateInterestPaymentPenalty: Размеры санкций за задержку оплаты начисленных процентов (например, "Аналогично штрафу за просрочку ОД"). Искать там же.
- lateCommissionPaymentPenalty: Штрафы за неоплату комиссий (например, "0.05% в день от суммы неоплаченной комиссии"). Искать там же.
- penaltyIndexation: Применяется ли увеличение размера неустойки (true/false). Искать в условиях о штрафах.

**Информация по сублимитам (массив объектов sublimitDetails). Если сублимиты не найдены, оставьте sublimitDetails пустым массивом:**
Для каждого сублимита:
  - sublimitAmount: Сумма сублимита (только числовое значение, например 500000). Искать в разделах о сублимитах или условиях кредитной линии.
  - sublimitCurrency: Валюта сублимита (например, RUB, USD). Обычно указывается рядом с суммой сублимита.
  - sublimitAvailabilityPeriod: Период доступности сублимита (например, 'до 31.12.2025', 'В течение 6 месяцев с даты выдачи'). Искать в условиях предоставления сублимита.
  - sublimitExpiryDate: Дата завершения действия сублимита (ГГГГ-ММ-ДД). Искать в условиях действия сублимита.
  - sublimitPurpose: Цели, на которые выделялся сублимит (например, 'Пополнение оборотных средств', 'Приобретение оборудования'). Искать в описании сублимита или целевом назначении кредита.
  - sublimitInvestmentPhase: Инвестиционная фаза сублимита (например, 'Инвестиционная', 'Операционная'). Может быть указано в описании цели сублимита.
  - sublimitRepaymentOrder: Особенности порядка погашения задолженности по сублимиту (например, 'Погашение после основного долга', 'Аннуитетные платежи'). Искать в условиях погашения сублимита.

**Дополнительные финансовые показатели (объект financialIndicatorsAndCalculations):**
- accruedInterestRate: Процентные ставки для начисленных процентов (число, например 12.5). Искать в разделе 'Процентная ставка'.
- capitalizedInterestRate: Процентные ставки для капитализированных процентов (число, например 0.5). Искать в условиях о капитализации процентов, если есть.
- accruedInterestCalculationRules: Правила и алгоритмы расчета начисленных процентов (например, 'На остаток основного долга', 'Формула X'). Искать в разделе о порядке начисления процентов.
- interestPaymentRegulations: Регламент уплат процентов (например, 'Ежемесячно, не позднее 5-го числа', 'В конце срока'). Искать в разделе о порядке уплаты процентов.
- debtAndCommissionReservingParams: Параметры резервирования по долгу и комиссиям (например, 'Согласно Положению ЦБ РФ № XXX'). Обычно это внутренняя информация банка, может отсутствовать в договоре.
- insuranceProductCodes: Специфические коды страховых продуктов, если применимо. Искать упоминания страхования в договоре.
- specialContractConditions: Особые условия договора, относящиеся к финансовым расчетам, не вошедшие в другие поля.

**Административные блоки:**
- finalCreditQualityCategory: Итоговая категория качества кредита (соответствие нормам ЦБ) (выбрать из: "Хорошее", "Проблемное", "Просроченное", "Не определена"). Обычно это внутренняя оценка банка.
- dispositionExecutorName: ФИО сотрудника, подготовившего распоряжение. Это поле заполняется пользователем сервиса, а не извлекается из договора.
- authorizedSignatory: Лицо, имеющее полномочия подписи от банка (ФИО). Может быть указано в преамбуле или реквизитах банка.

Убедитесь, что все текстовые описания и извлеченная информация на русском языке.
Структурируйте ответ строго согласно указанным полям вывода в объекте 'dispositionCard'.
Если в документе нет информации для целого объекта (например, earlyRepaymentConditions), этот объект можно опустить (если он опционален по схеме) или вернуть с пустыми/null значениями для его полей.
`,
});

const generateCreditDispositionFlow = ai.defineFlow(
  {
    name: 'generateCreditDispositionFlow',
    inputSchema: GenerateCreditDispositionInputSchema,
    outputSchema: GenerateCreditDispositionOutputSchema,
  },
  async (input: GenerateCreditDispositionInput): Promise<GenerateCreditDispositionOutput> => {
    const dataUriParts = input.documentDataUri.match(/^data:(.+?);base64,(.*)$/);
    if (!dataUriParts || dataUriParts[1] !== 'application/pdf') {
      throw new Error('Неверный формат файла. Ожидается PDF файл в формате data URI.');
    }

    const MAX_RETRIES = 3;
    const INITIAL_DELAY_MS = 1500; 
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const result = await prompt(input, {
          config: {
            safetySettings: [ // Relaxed safety settings for legal/financial documents
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' }, // Keep high for financial docs
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          }
        });
        const output = result.output;

        if (output && output.dispositionCard) {
          // Ensure nested objects and arrays are initialized if AI omits them
          output.dispositionCard.earlyRepaymentConditions = output.dispositionCard.earlyRepaymentConditions || {};
          output.dispositionCard.penaltySanctions = output.dispositionCard.penaltySanctions || {};
          output.dispositionCard.financialIndicatorsAndCalculations = output.dispositionCard.financialIndicatorsAndCalculations || {};
          output.dispositionCard.sublimitDetails = output.dispositionCard.sublimitDetails || [];
          output.dispositionCard.commissionPaymentSchedule = output.dispositionCard.commissionPaymentSchedule || [];
          
          // Enhanced retry condition: check for critical fields
          if (
            attempt < MAX_RETRIES -1 && // Only retry if not the last attempt
            (!output.dispositionCard.borrowerName || 
             !output.dispositionCard.contractNumber || 
             output.dispositionCard.contractAmount === null || 
             output.dispositionCard.contractAmount === undefined
            )
          ) {
            console.warn(`Attempt ${attempt + 1}: Critical fields (borrowerName, contractNumber, or contractAmount) missing. Retrying...`);
            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue; // Skip to next iteration for retry
          }
          return output;
        }
        
        // If !output.dispositionCard and this is the last attempt
        if (attempt === MAX_RETRIES - 1) {
          throw new Error('AI не вернул ожидаемый результат (dispositionCard) после нескольких попыток.');
        }

      } catch (e: any) {
        const errorMessage = typeof e.message === 'string' ? e.message.toLowerCase() : JSON.stringify(e);
        // Check for common retryable errors
        const isRetryableError = 
          errorMessage.includes('503') || // Service Unavailable
          errorMessage.includes('overloaded') || // Model Overloaded
          errorMessage.includes('service unavailable') ||
          errorMessage.includes('rate limit') || // Rate limit exceeded
          errorMessage.includes('resource has been exhausted') || // Common for complex tasks
          errorMessage.includes('deadline exceeded') || // Timeout
          errorMessage.includes('internal error') || // General Google error
          errorMessage.includes('try again later') ||
          errorMessage.includes('429'); // HTTP 429 Too Many Requests
        
        if (isRetryableError) {
          if (attempt === MAX_RETRIES - 1) {
            // Last attempt failed with a retryable error
            throw new Error('Сервис временно перегружен или достигнут лимит запросов. Пожалуйста, попробуйте позже.');
          }
          // Wait before retrying
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Attempt ${attempt + 1}: Retryable error encountered: ${errorMessage}. Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-retryable error
          console.error("Non-retryable error in generateCreditDispositionFlow:", e);
          throw e; 
        }
      }
      attempt++;
    }
    // Fallback, should ideally not be reached if logic is perfect.
    // This will be hit if all retries result in no output without throwing a catchable error.
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }
);
