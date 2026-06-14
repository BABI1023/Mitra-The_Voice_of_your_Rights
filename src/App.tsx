import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, ChevronRight, RotateCcw, FileText, CheckCircle2, ExternalLink, Info, Sparkles, Home, HelpCircle } from 'lucide-react';
import schemesData from './data/schemes.json';

// Types
interface Profile {
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  has_farmland: boolean | null;
  land_size_acres: number | null;
  monthly_income: number | null;
  house_type: 'pucca' | 'kucha' | null;
  occupation: string | null;
  has_bank_account: boolean | null;
  has_aadhaar: boolean | null;
  has_lpg_connection: boolean | null;
}

interface Scheme {
  id: string;
  name: string;
  hindi_name: string;
  category: string;
  benefit: string;
  description: string;
  rules: { all_of?: Condition[]; any_of?: Condition[] };
  why_template: string;
  almost_eligible_hint: string | null;
  apply_link: string;
}

interface Condition {
  field: string;
  operator: 'equals' | 'gte' | 'lte' | 'lt' | 'gt' | 'in';
  value: string | number | boolean | string[];
}

interface MatchedScheme extends Scheme {
  matchReason: string;
  isCloseMatch: boolean;
  missingConditions?: string[];
}

type AppScreen = 'home' | 'question' | 'loading' | 'results' | 'info';

const questions = [
  {
    id: 'age_gender',
    question: 'What is your age? Are you applying as male, female, or other?',
    hindi: 'आपकी उम्र क्या है? क्या आप पुरुष, महिला, या अन्य के रूप में आवेदन कर रहे हैं?',
    hint: 'E.g., "35 years old, male" or "40, female"',
    quickButtons: ['Male / पुरुष', 'Female / महिला', 'Other / अन्य'],
    parse: parseAgeGender,
  },
  {
    id: 'farmland',
    question: 'Does your family own any farmland? If yes, roughly how many acres?',
    hindi: 'क्या आपके परिवार के पास कोई खेती की जमीन है? अगर हाँ, तो लगभग कितने एकड़?',
    hint: 'E.g., "Yes, 3 acres" or "No farmland"',
    quickButtons: ['No farmland / कोई जमीन नहीं', '1-2 acres', '3-5 acres', 'More than 5 acres'],
    parse: parseFarmland,
  },
  {
    id: 'income',
    question: 'What is your family\'s total monthly income, in rupees?',
    hindi: 'आपके परिवार की कुल मासिक आय, रुपये में क्या है?',
    hint: 'E.g., "8000" or "8000 rupees per month"',
    quickButtons: ['Under ₹5,000', '₹5,000 - ₹10,000', '₹10,000 - ₹15,000', 'Above ₹15,000'],
    parse: parseIncome,
  },
  {
    id: 'house',
    question: 'What type of house do you live in — pucca (concrete/brick) or kucha (mud/thatch)?',
    hindi: 'आप किस प्रकार के घर में रहते हैं — पक्का (कंक्रीट/ईंट) या कच्चा (मिट्टी/फूस)?',
    hint: '',
    quickButtons: ['Pucca (Concrete) / पक्का', 'Kucha (Mud/Thatch) / कच्चा'],
    parse: parseHouse,
  },
  {
    id: 'occupation',
    question: 'What is your main occupation?',
    hindi: 'आपका मुख्य व्यवसाय क्या है?',
    hint: '',
    quickButtons: [
      'Farming / खेती',
      'Daily wage labor / मजदूरी',
      'Street vending / रेहड़ी',
      'Domestic work / घरेलू काम',
      'Construction / निर्माण',
      'Salaried job / नौकरी',
      'Other / अन्य',
    ],
    parse: parseOccupation,
  },
  {
    id: 'documents',
    question: 'Do you have a bank account and an Aadhaar card? And do you currently have an LPG gas connection at home?',
    hindi: 'क्या आपके पास बैंक खाता और आधार कार्ड है? क्या आपके घर में वर्तमान में एलपीजी गैस कनेक्शन है?',
    hint: 'E.g., "Yes to all" or "I have Aadhaar and bank but no LPG"',
    quickButtons: ['Yes to all / सब हैं', 'Bank + Aadhaar only', 'Aadhaar only', 'None of these'],
    parse: parseDocuments,
  },
];

function parseAgeGender(input: string, quickBtn?: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  const inputLower = input.toLowerCase();

  if (quickBtn) {
    if (quickBtn.includes('Male')) result.gender = 'male';
    else if (quickBtn.includes('Female')) result.gender = 'female';
    else if (quickBtn.includes('Other')) result.gender = 'other';
  }

  const ageMatch = input.match(/(\d+)/);
  if (ageMatch) result.age = parseInt(ageMatch[1]);

  if (!result.gender) {
    if (/(?:male|पुरुष|mr\.|m\b)/i.test(inputLower)) result.gender = 'male';
    else if (/(?:female|महिला|mrs\.|ms\.|f\b)/i.test(inputLower)) result.gender = 'female';
    else if (/(?:other|अन्य)/i.test(inputLower)) result.gender = 'other';
  }

  return result;
}

function parseFarmland(input: string, quickBtn?: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  const inputLower = input.toLowerCase();

  const noLand = /(?:no|नहीं|none|zero|0)/i.test(inputLower);
  const hasLand = /(?:yes|हाँ|हां|acre|एकड़)/i.test(inputLower);

  if (quickBtn) {
    if (quickBtn.includes('No farmland')) {
      result.has_farmland = false;
      result.land_size_acres = 0;
    } else if (quickBtn.includes('1-2')) {
      result.has_farmland = true;
      result.land_size_acres = 1.5;
    } else if (quickBtn.includes('3-5')) {
      result.has_farmland = true;
      result.land_size_acres = 4;
    } else if (quickBtn.includes('More')) {
      result.has_farmland = true;
      result.land_size_acres = 8;
    }
  } else {
    if (noLand) {
      result.has_farmland = false;
      result.land_size_acres = 0;
    } else if (hasLand) {
      result.has_farmland = true;
      const acreMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:acres?|एकड़)?/i);
      result.land_size_acres = acreMatch ? parseFloat(acreMatch[1]) : 2;
    }
  }

  return result;
}

function parseIncome(input: string, quickBtn?: string): Partial<Profile> {
  const result: Partial<Profile> = {};

  if (quickBtn) {
    if (quickBtn.includes('Under')) result.monthly_income = 4000;
    else if (quickBtn.includes('5,000')) result.monthly_income = 7500;
    else if (quickBtn.includes('10,000')) result.monthly_income = 12500;
    else if (quickBtn.includes('Above')) result.monthly_income = 20000;
  } else {
    const numMatch = input.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
    if (numMatch) {
      result.monthly_income = parseInt(numMatch[1].replace(/,/g, ''));
    }
  }

  return result;
}

function parseHouse(input: string, quickBtn?: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  const inputLower = input.toLowerCase();

  if (quickBtn) {
    result.house_type = quickBtn.includes('Pucca') ? 'pucca' : 'kucha';
  } else {
    if (/(?:pucca|पक्का|concrete|brick|cement)/i.test(inputLower)) {
      result.house_type = 'pucca';
    } else if (/(?:kucha|कच्चा|मिट्टी|thatch|mud)/i.test(inputLower)) {
      result.house_type = 'kucha';
    }
  }

  return result;
}

function parseOccupation(input: string, quickBtn?: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  const inputLower = input.toLowerCase();

  const occupationMap: Record<string, string> = {
    'farmer': 'farmer',
    'farming': 'farmer',
    'खेती': 'farmer',
    'daily': 'daily_wage_laborer',
    'wage': 'daily_wage_laborer',
    'labor': 'daily_wage_laborer',
    'labour': 'daily_wage_laborer',
    'मजदूर': 'daily_wage_laborer',
    'street': 'street_vendor',
    'vendor': 'street_vendor',
    'rehri': 'street_vendor',
    'रेहड़ी': 'street_vendor',
    'domestic': 'domestic_worker',
    'घरेलू': 'domestic_worker',
    'construction': 'construction_worker',
    'निर्माण': 'construction_worker',
    'salaried': 'salaried',
    'job': 'salaried',
    'नौकरी': 'salaried',
    'employee': 'salaried',
  };

  if (quickBtn) {
    if (quickBtn.includes('Farming')) result.occupation = 'farmer';
    else if (quickBtn.includes('Daily')) result.occupation = 'daily_wage_laborer';
    else if (quickBtn.includes('Street')) result.occupation = 'street_vendor';
    else if (quickBtn.includes('Domestic')) result.occupation = 'domestic_worker';
    else if (quickBtn.includes('Construction')) result.occupation = 'construction_worker';
    else if (quickBtn.includes('Salaried')) result.occupation = 'salaried';
    else if (quickBtn.includes('Other')) result.occupation = 'other_informal';
  } else {
    for (const [key, value] of Object.entries(occupationMap)) {
      if (inputLower.includes(key)) {
        result.occupation = value;
        break;
      }
    }
    if (!result.occupation) result.occupation = 'other_informal';
  }

  return result;
}

function parseDocuments(input: string, quickBtn?: string): Partial<Profile> {
  const result: Partial<Profile> = {};
  const inputLower = input.toLowerCase();

  if (quickBtn) {
    if (quickBtn.includes('Yes to all')) {
      result.has_bank_account = true;
      result.has_aadhaar = true;
      result.has_lpg_connection = true;
    } else if (quickBtn.includes('Bank + Aadhaar')) {
      result.has_bank_account = true;
      result.has_aadhaar = true;
      result.has_lpg_connection = false;
    } else if (quickBtn.includes('Aadhaar only')) {
      result.has_bank_account = false;
      result.has_aadhaar = true;
      result.has_lpg_connection = false;
    } else if (quickBtn.includes('None')) {
      result.has_bank_account = false;
      result.has_aadhaar = false;
      result.has_lpg_connection = false;
    }
  } else {
    result.has_bank_account = /(?:bank|बैंक|खाता)/i.test(inputLower) && !/(?:no bank|नहीं)/i.test(inputLower);
    result.has_aadhaar = /(?:aadhaar|aadhar|आधार)/i.test(inputLower) && !/(?:no aadhaar)/i.test(inputLower);
    result.has_lpg_connection = /(?:lpg|gas|गैस|cylinder)/i.test(inputLower) && !/(?:no lpg|no gas|नहीं)/i.test(inputLower);

    if (/(?:yes to all|सब हैं)/i.test(inputLower)) {
      result.has_bank_account = true;
      result.has_aadhaar = true;
      result.has_lpg_connection = true;
    }
  }

  return result;
}

function evaluateCondition(condition: Condition, profile: Profile): boolean {
  const fieldValue = profile[condition.field as keyof Profile];

  if (fieldValue === null || fieldValue === undefined) return false;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'gte':
      return (fieldValue as number) >= (condition.value as number);
    case 'lte':
      return (fieldValue as number) <= (condition.value as number);
    case 'lt':
      return (fieldValue as number) < (condition.value as number);
    case 'gt':
      return (fieldValue as number) > (condition.value as number);
    case 'in':
      return (condition.value as string[]).includes(fieldValue as string);
    default:
      return false;
  }
}

function matchSchemes(profile: Profile): { matched: MatchedScheme[]; almostEligible: MatchedScheme[] } {
  const matched: MatchedScheme[] = [];
  const almostEligible: MatchedScheme[] = [];

  for (const scheme of schemesData.schemes as Scheme[]) {
    const allConditions = scheme.rules.all_of || scheme.rules.any_of || [];
    const isAllOf = !!scheme.rules.all_of;

    const results = allConditions.map(c => ({
      condition: c,
      passed: evaluateCondition(c, profile),
    }));

    const passedCount = results.filter(r => r.passed).length;
    const allPassed = isAllOf ? results.every(r => r.passed) : passedCount > 0;

    if (allPassed) {
      const matchedCriteria = results
        .filter(r => r.passed)
        .map(r => getCriteriaDescription(r.condition, profile));

      let matchReason = scheme.why_template;
      if (scheme.why_template.includes('{matched_criteria_description}')) {
        matchReason = scheme.why_template.replace('{matched_criteria_description}', matchedCriteria.join(', '));
      } else if (scheme.why_template.includes('{')) {
        matchReason = interpolateTemplate(scheme.why_template, profile);
      }

      matched.push({ ...scheme, matchReason, isCloseMatch: false });
    } else if (scheme.almost_eligible_hint && (isAllOf ? passedCount >= allConditions.length - 1 : passedCount >= allConditions.length * 0.5)) {
      const missing = results
        .filter(r => !r.passed)
        .map(r => getCriteriaDescription(r.condition, profile, true));

      almostEligible.push({
        ...scheme,
        matchReason: scheme.almost_eligible_hint || '',
        isCloseMatch: true,
        missingConditions: missing,
      });
    }
  }

  return { matched, almostEligible };
}

function getCriteriaDescription(condition: Condition, profile: Profile, isMissing = false): string {
  const fieldNames: Record<string, string> = {
    age: 'age',
    gender: 'gender',
    has_farmland: 'farmland ownership',
    land_size_acres: 'land size',
    monthly_income: 'monthly income',
    house_type: 'house type',
    occupation: 'occupation',
    has_bank_account: 'bank account',
    has_aadhaar: 'Aadhaar card',
    has_lpg_connection: 'LPG connection',
  };

  const fieldName = fieldNames[condition.field] || condition.field;
  const value = profile[condition.field as keyof Profile];

  if (isMissing) {
    return `${fieldName} (currently: ${value})`;
  }

  return `${fieldName}: ${value}`;
}

function interpolateTemplate(template: string, profile: Profile): string {
  let result = template;
  for (const [key, value] of Object.entries(profile)) {
    const placeholder = `{${key}}`;
    if (result.includes(placeholder)) {
      result = result.replace(new RegExp(placeholder, 'g'), String(value ?? ''));
    }
  }
  return result;
}

function estimateBenefit(matched: MatchedScheme[]): string {
  const fixedBenefits = matched.filter(s =>
    s.benefit.includes('₹6,000') ||
    s.benefit.includes('₹1.2') ||
    s.benefit.includes('1.3 lakh')
  );

  if (fixedBenefits.length === 0) return 'significant government support';

  let total = 0;
  for (const s of fixedBenefits) {
    if (s.benefit.includes('₹6,000')) total += 6000;
    if (s.benefit.includes('₹1.2') || s.benefit.includes('1.3 lakh')) total += 125000;
  }

  if (total >= 100000) return `₹${(total / 100000).toFixed(1)} lakh`;
  return `₹${total.toLocaleString()}`;
}

function getRequiredDocuments(matched: MatchedScheme[]): string[] {
  const docs = new Set<string>();

  for (const scheme of matched) {
    if (scheme.rules.all_of?.some(r => r.field === 'has_aadhaar') ||
        scheme.rules.any_of?.some(r => r.field === 'has_aadhaar')) {
      docs.add('Aadhaar Card / आधार कार्ड');
    }
    if (scheme.rules.all_of?.some(r => r.field === 'has_bank_account') ||
        scheme.rules.any_of?.some(r => r.field === 'has_bank_account')) {
      docs.add('Bank Passbook / बैंक पासबुक');
    }
    if (scheme.id === 'pm-kisan') {
      docs.add('Land Records / जमीन के कागज');
    }
    if (scheme.id === 'pm-jay') {
      docs.add('Ration Card (if applicable) / राशन कार्ड');
    }
    if (scheme.id === 'pmay') {
      docs.add('Address Proof / पता प्रमाण');
      docs.add('Income Certificate / आय प्रमाण पत्र');
    }
    if (scheme.id === 'apy') {
      docs.add('KYC Documents / केवाईसी दस्तावेज');
    }
    if (scheme.id === 'ujjwala') {
      docs.add('Below Poverty Line Proof / बीपीएल प्रमाण');
    }
  }

  docs.add('Passport Photo / पासपोर्ट फोटो');

  return Array.from(docs);
}

// Mitra Avatar Component
function MitraAvatar({ speaking }: { speaking?: boolean }) {
  return (
    <div className="relative">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-saffron-400 to-saffron-500 flex items-center justify-center shadow-lg shadow-saffron-400/30">
        <svg viewBox="0 0 36 36" className="w-9 h-9 text-white">
          <circle cx="18" cy="12" r="6" fill="currentColor" />
          <path d="M6 32c0-8 6-12 12-12s12 4 12 12" fill="currentColor" />
        </svg>
      </div>
      {speaking && (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-5 w-5 bg-teal-500"></span>
        </span>
      )}
    </div>
  );
}

// Voice Hook
function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionAPI);

    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'hi-IN';
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!recognitionRef.current) return;

    recognitionRef.current.onresult = (event) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setIsListening(false);
    };

    recognitionRef.current.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  return { isListening, isSupported, startListening, stopListening, speak };
}

// Home Screen
function HomeScreen({ onStart, onInfo }: { onStart: () => void; onInfo: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-cream-200 to-amber-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-6 right-6">
        <button
          onClick={onInfo}
          className="p-2 rounded-full bg-white/50 hover:bg-white/80 transition-colors"
        >
          <Info className="w-5 h-5 text-teal-700" />
        </button>
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-saffron-300/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-300/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto animate-fade-in">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-saffron-400 to-saffron-500 flex items-center justify-center shadow-2xl shadow-saffron-400/40 transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center shadow-lg">
              <Mic className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-3 text-gradient">
          MITRA
        </h1>
        <p className="text-xl text-teal-700 font-medium mb-1 hindi-text">
          अपने हक़ की आवाज़
        </p>
        <p className="text-sm text-teal-600 mb-8 italic">
          The Voice of Your Rights
        </p>

        <p className="text-base md:text-lg text-teal-800/90 mb-10 leading-relaxed">
          Find the government schemes you qualify for —<br />
          <span className="text-saffron-600 font-medium">in your language, by voice.</span>
        </p>

        <button
          onClick={onStart}
          className="btn-primary text-lg px-10 py-4 flex items-center gap-3 mx-auto"
        >
          <span>Start / शुरू करें</span>
          <ChevronRight className="w-5 h-5" />
        </button>

        <p className="mt-8 text-sm text-teal-600/70">
          Takes only 2 minutes • Works offline
        </p>
      </div>
    </div>
  );
}

// Info Modal
function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-teal-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-teal-900 mb-1">How This Works</h3>
            <p className="text-sm text-teal-600">यह कैसे काम करता है</p>
          </div>
        </div>

        <p className="text-teal-800 leading-relaxed mb-6">
          Mitra asks you a few simple questions, matches your answers against real government scheme rules, and shows you exactly what you qualify for and why — in your language.
        </p>

        <div className="bg-cream-100 rounded-xl p-4 mb-6">
          <p className="text-sm text-teal-700 hindi-text">
            मित्र आपसे कुछ सवाल पूछता है, आपके जवाब को असली सरकारी योजना नियमों से मिलाता है, और आपको बताता है कि आप किसके पात्र हैं और क्यों — आपकी भाषा में।
          </p>
        </div>

        <button onClick={onClose} className="btn-secondary w-full">
          Got it / समझ गए
        </button>
      </div>
    </div>
  );
}

// Question Screen
function QuestionScreen({
  questionIndex,
  question,
  profile,
  onAnswer,
  onBack,
  speak,
  startListening,
  stopListening,
  isListening,
  voiceSupported,
}: {
  questionIndex: number;
  question: typeof questions[0];
  profile: Profile;
  onAnswer: (value: Partial<Profile>) => void;
  onBack: () => void;
  speak: (text: string) => void;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  isListening: boolean;
  voiceSupported: boolean;
}) {
  const [input, setInput] = useState('');
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const progress = ((questionIndex + 1) / questions.length) * 100;

  useEffect(() => {
    setInput('');
    setSelectedQuick(null);
  }, [questionIndex]);

  const handleSpeak = () => {
    setIsSpeaking(true);
    speak(`${question.hindi}. ${question.question}`);
    setTimeout(() => setIsSpeaking(false), 5000);
  };

  const handleSubmit = (quickBtn?: string) => {
    const parsed = question.parse(quickBtn ? '' : input, quickBtn);
    if (Object.keys(parsed).length > 0 || quickBtn) {
      onAnswer(parsed);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((text) => {
        setInput(text);
      });
    }
  };

  const allQuickButtonsSelected = selectedQuick !== null || input.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-cream-200 to-amber-50 flex flex-col">
      <div className="w-full bg-teal-850 h-1.5">
        <div
          className="h-full bg-gradient-to-r from-saffron-400 to-saffron-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col px-4 py-6 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-white/50 transition-colors"
          >
            <svg className="w-5 h-5 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-teal-600">
            {questionIndex + 1} of {questions.length}
          </span>
          <div className="w-9" />
        </div>

        <div className="flex items-start gap-3 mb-6 animate-fade-in">
          <MitraAvatar speaking={isSpeaking} />
          <div className="flex-1">
            <div className="card">
              <p className="text-teal-900 text-lg font-medium mb-2">
                {question.question}
              </p>
              <p className="text-teal-600 hindi-text text-base">
                {question.hindi}
              </p>
              {question.hint && (
                <p className="text-teal-500 text-sm mt-2 italic">
                  💡 {question.hint}
                </p>
              )}
            </div>

            <button
              onClick={handleSpeak}
              className="mt-3 flex items-center gap-2 text-teal-600 hover:text-teal-800 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span className="text-sm">Read aloud / पढ़कर सुनाएं</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col animate-slide-up">
          <div className="mb-4">
            <p className="text-sm text-teal-600 mb-2">Quick answers:</p>
            <div className="flex flex-wrap gap-2">
              {question.quickButtons.map((btn) => (
                <button
                  key={btn}
                  onClick={() => {
                    setSelectedQuick(btn);
                    setInput('');
                  }}
                  className={`quick-btn text-xs ${selectedQuick === btn ? 'quick-btn-active' : ''}`}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>

          <div className="relative mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setSelectedQuick(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Or type your answer / या टाइप करें..."
              className="input-field pr-12"
            />
            {voiceSupported && (
              <button
                onClick={handleMicClick}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${
                  isListening
                    ? 'bg-saffron-500 text-white animate-pulse-soft'
                    : 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>

          <button
            onClick={() => handleSubmit(selectedQuick || undefined)}
            disabled={!allQuickButtonsSelected}
            className={`btn-primary w-full flex items-center justify-center gap-2 ${
              !allQuickButtonsSelected ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span>Continue / आगे बढ़ें</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Screen
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-cream-200 to-amber-50 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <MitraAvatar speaking />
        </div>
        <div className="flex items-center gap-3 text-teal-700 mb-4">
          <div className="w-5 h-5 border-2 border-teal-400 border-t-saffron-500 rounded-full animate-spin"></div>
          <span className="text-lg font-medium">Finding your schemes...</span>
        </div>
        <p className="text-teal-600 hindi-text">आपकी योजनाएं खोजी जा रही हैं...</p>
      </div>
    </div>
  );
}

// Results Screen
function ResultsScreen({
  matched,
  almostEligible,
  onRestart,
  speak,
}: {
  matched: MatchedScheme[];
  almostEligible: MatchedScheme[];
  onRestart: () => void;
  speak: (text: string) => void;
}) {
  const [readingResults, setReadingResults] = useState(false);
  const requiredDocs = getRequiredDocuments(matched);
  const benefitEstimate = estimateBenefit(matched);

  const handleReadResults = () => {
    setReadingResults(true);
    const intro = `You qualify for ${matched.length} schemes. `;
    const schemeTexts = matched.map(s =>
      `${s.name}, with benefits: ${s.benefit.replace(/₹/g, 'rupees ')}`
    ).join('. ');
    speak(intro + schemeTexts);
    setTimeout(() => setReadingResults(false), 8000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 via-cream-200 to-amber-50 pb-8">
      <div className="bg-gradient-to-r from-teal-850 to-teal-700 text-white px-4 py-8 mb-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <MitraAvatar />
            <div>
              <p className="text-cream-200 text-sm">Your personalized results</p>
              <p className="hindi-text text-cream-100">आपके व्यक्तिगत परिणाम</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
            <p className="text-2xl font-bold mb-2">
              <span className="text-saffron-300">{matched.length}</span> schemes matched
            </p>
            <p className="text-cream-100">
              Based on your answers, you may qualify for <span className="text-saffron-300 font-semibold">{benefitEstimate}</span> in benefits
            </p>
            <p className="text-cream-200 text-sm hindi-text mt-2">
              आपके जवाबों के आधार पर, आप लगभग {benefitEstimate} के लाभ के पात्र हो सकते हैं
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReadResults}
              disabled={readingResults}
              className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {readingResults ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="text-sm">Read Aloud</span>
            </button>
            <button
              onClick={onRestart}
              className="bg-white/20 hover:bg-white/30 text-white py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm">Start Over</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          {matched.map((scheme, index) => (
            <div
              key={scheme.id}
              className="card mb-4 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="inline-block px-3 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full mb-2">
                    {scheme.category}
                  </span>
                  <h3 className="text-xl font-bold text-teal-900">{scheme.name}</h3>
                  <p className="text-teal-600 hindi-text">{scheme.hindi_name}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-teal-500 flex-shrink-0" />
              </div>

              <div className="bg-gradient-to-r from-saffron-50 to-amber-50 rounded-xl p-4 mb-4">
                <p className="text-lg font-semibold text-saffron-700">{scheme.benefit}</p>
              </div>

              <p className="text-teal-700 text-sm mb-4">{scheme.description}</p>

              <div className="bg-teal-50 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-teal-800 mb-1">✓ Why you qualify / आप क्यों पात्र हैं:</p>
                <p className="text-teal-700 text-sm">{scheme.matchReason}</p>
              </div>

              <a
                href={scheme.apply_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                <span>Apply Now / अभी आवेदन करें</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        {almostEligible.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-teal-800 mb-4 flex items-center gap-2">
              <span className="text-saffron-500">⏳</span> Almost There / बस थोड़ा और
            </h3>
            {almostEligible.map((scheme) => (
              <div key={scheme.id} className="card mb-3 bg-amber-50/50 border-amber-200">
                <h4 className="font-semibold text-teal-900 mb-1">{scheme.name}</h4>
                <p className="text-sm text-amber-700">{scheme.matchReason}</p>
              </div>
            ))}
          </div>
        )}

        {requiredDocs.length > 0 && (
          <div className="card mb-8 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-teal-600" />
              <h3 className="text-lg font-semibold text-teal-900">Documents You'll Need</h3>
            </div>
            <p className="text-teal-600 text-sm mb-4 hindi-text">आपको ये दस्तावेज चाहिए होंगे</p>

            <div className="space-y-2">
              {requiredDocs.map((doc, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-cream-50 rounded-lg">
                  <div className="w-5 h-5 rounded-full border-2 border-teal-300 flex items-center justify-center text-xs text-teal-600">
                    {index + 1}
                  </div>
                  <span className="text-teal-800 text-sm">{doc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onRestart}
          className="w-full bg-teal-100 hover:bg-teal-200 text-teal-800 font-medium py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors mb-8"
        >
          <Home className="w-4 h-4" />
          <span>Start New Search / नई खोज शुरू करें</span>
        </button>
      </div>
    </div>
  );
}

// Main App
function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [profile, setProfile] = useState<Profile>({
    age: null,
    gender: null,
    has_farmland: null,
    land_size_acres: null,
    monthly_income: null,
    house_type: null,
    occupation: null,
    has_bank_account: null,
    has_aadhaar: null,
    has_lpg_connection: null,
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [matchedSchemes, setMatchedSchemes] = useState<{ matched: MatchedScheme[]; almostEligible: MatchedScheme[] }>({
    matched: [],
    almostEligible: [],
  });

  const { isListening, isSupported: voiceSupported, startListening, stopListening, speak } = useVoice();

  const handleStart = () => {
    setScreen('question');
    setQuestionIndex(0);
    setProfile({
      age: null,
      gender: null,
      has_farmland: null,
      land_size_acres: null,
      monthly_income: null,
      house_type: null,
      occupation: null,
      has_bank_account: null,
      has_aadhaar: null,
      has_lpg_connection: null,
    });
  };

  const handleAnswer = (answer: Partial<Profile>) => {
    const newProfile = { ...profile, ...answer };
    setProfile(newProfile);

    if (questionIndex < questions.length - 1) {
      setQuestionIndex(questionIndex + 1);
    } else {
      setScreen('loading');
      setTimeout(() => {
        const results = matchSchemes(newProfile);
        setMatchedSchemes(results);
        setScreen('results');
      }, 2000);
    }
  };

  const handleBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
    } else {
      setScreen('home');
    }
  };

  const handleRestart = () => {
    setScreen('home');
    setQuestionIndex(0);
  };

  return (
    <>
      {screen === 'home' && (
        <HomeScreen onStart={handleStart} onInfo={() => setScreen('info')} />
      )}
      {screen === 'info' && (
        <InfoModal onClose={() => setScreen('home')} />
      )}
      {screen === 'question' && (
        <QuestionScreen
          questionIndex={questionIndex}
          question={questions[questionIndex]}
          profile={profile}
          onAnswer={handleAnswer}
          onBack={handleBack}
          speak={speak}
          startListening={startListening}
          stopListening={stopListening}
          isListening={isListening}
          voiceSupported={voiceSupported}
        />
      )}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'results' && (
        <ResultsScreen
          matched={matchedSchemes.matched}
          almostEligible={matchedSchemes.almostEligible}
          onRestart={handleRestart}
          speak={speak}
        />
      )}
    </>
  );
}

export default App;
