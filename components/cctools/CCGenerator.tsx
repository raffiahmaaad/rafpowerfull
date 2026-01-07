import React, { useState } from 'react';
import { CreditCard, Copy, RefreshCw, AlertTriangle, CheckCircle, XCircle, Settings, Zap, ArrowLeft, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

// Luhn Algorithm
const luhnCheck = (cardNumber: string): boolean => {
  const digits = cardNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

// Generate Luhn check digit
const generateLuhnCheckDigit = (partialNumber: string): number => {
  const digits = partialNumber.replace(/\D/g, '');
  let sum = 0;
  let isEven = true;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return (10 - (sum % 10)) % 10;
};

// Card Brand Definitions
interface CardBrand {
  name: string;
  prefixes: string[];
  lengths: number[];
  color: string;
  icon: string;
}

const cardBrands: CardBrand[] = [
  { name: 'Visa', prefixes: ['4'], lengths: [16], color: '#1a1f71', icon: '💳' },
  { name: 'Mastercard', prefixes: ['51', '52', '53', '54', '55', '2221', '2720'], lengths: [16], color: '#eb001b', icon: '💳' },
  { name: 'American Express', prefixes: ['34', '37'], lengths: [15], color: '#006fcf', icon: '💳' },
  { name: 'Discover', prefixes: ['6011', '644', '645', '646', '647', '648', '649', '65'], lengths: [16], color: '#ff6000', icon: '💳' },
  { name: 'JCB', prefixes: ['3528', '3589'], lengths: [16], color: '#0070ba', icon: '💳' },
  { name: 'Diners Club', prefixes: ['36', '38', '300', '301', '302', '303', '304', '305'], lengths: [14], color: '#004080', icon: '💳' },
  { name: 'UnionPay', prefixes: ['62'], lengths: [16, 17, 18, 19], color: '#d0021b', icon: '💳' },
];

// Detect card brand from number
const detectCardBrand = (number: string): CardBrand | null => {
  const digits = number.replace(/\D/g, '');
  for (const brand of cardBrands) {
    for (const prefix of brand.prefixes) {
      if (digits.startsWith(prefix)) {
        return brand;
      }
    }
  }
  return null;
};

// Generate random digits
const randomDigits = (length: number): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

// Generate expiration date
const generateExpDate = (randomize: boolean): { month: string; year: string } => {
  if (randomize) {
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const currentYear = new Date().getFullYear();
    const year = String(currentYear + Math.floor(Math.random() * 5) + 1).slice(-2);
    return { month, year };
  }
  return { month: '12', year: '25' };
};

// Generate CVV
const generateCVV = (length: number = 3): string => {
  return randomDigits(length);
};

interface GeneratedCard {
  number: string;
  formattedNumber: string;
  brand: CardBrand | null;
  expMonth: string;
  expYear: string;
  cvv: string;
  isValid: boolean;
}

interface CCGeneratorProps {
  onBack: () => void;
}

export const CCGenerator: React.FC<CCGeneratorProps> = ({ onBack }) => {
  const [bin, setBin] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [includeDate, setIncludeDate] = useState(true);
  const [includeCVV, setIncludeCVV] = useState(true);
  const [format, setFormat] = useState<'pipe' | 'newline' | 'json'>('pipe');
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New options for exp and CVV
  const [expMonth, setExpMonth] = useState<string>('random');
  const [expYear, setExpYear] = useState<string>('random');
  const [customCVV, setCustomCVV] = useState<string>('');
  
  // Validation mode
  const [validateMode, setValidateMode] = useState(false);
  const [inputNumber, setInputNumber] = useState('');
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    brand: CardBrand | null;
    message: string;
  } | null>(null);

  // Generate years for selector (current year + 10 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear + i + 1);

  const generateCards = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const cards: GeneratedCard[] = [];
      
      for (let i = 0; i < quantity; i++) {
        let prefix = bin.trim() || '4'; // Default to Visa if no BIN
        const brand = detectCardBrand(prefix);
        const totalLength = brand?.lengths[0] || 16;
        
        // Generate remaining digits (excluding check digit)
        const remainingLength = totalLength - prefix.length - 1;
        const partial = prefix + randomDigits(remainingLength);
        
        // Generate Luhn check digit
        const checkDigit = generateLuhnCheckDigit(partial);
        const fullNumber = partial + checkDigit;
        
        // Format number
        const formattedNumber = fullNumber.match(/.{1,4}/g)?.join(' ') || fullNumber;
        
        // Generate exp date based on settings
        let month: string;
        let year: string;
        
        if (expMonth === 'random') {
          month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        } else {
          month = expMonth;
        }
        
        if (expYear === 'random') {
          year = String(currentYear + Math.floor(Math.random() * 5) + 1).slice(-2);
        } else {
          year = expYear.slice(-2);
        }
        
        // Generate CVV based on settings
        let cvv: string;
        const cvvLength = brand?.name === 'American Express' ? 4 : 3;
        
        if (customCVV.trim() !== '') {
          cvv = customCVV.padStart(cvvLength, '0').slice(0, cvvLength);
        } else {
          cvv = generateCVV(cvvLength);
        }
        
        cards.push({
          number: fullNumber,
          formattedNumber,
          brand: detectCardBrand(fullNumber),
          expMonth: month,
          expYear: year,
          cvv,
          isValid: luhnCheck(fullNumber)
        });
      }
      
      setGeneratedCards(cards);
      setIsGenerating(false);
      toast.success(`Generated ${quantity} test card numbers`);
    }, 300);
  };

  const validateCard = () => {
    const cleaned = inputNumber.replace(/\D/g, '');
    
    if (cleaned.length < 13 || cleaned.length > 19) {
      setValidationResult({
        isValid: false,
        brand: null,
        message: 'Invalid length. Card numbers are typically 13-19 digits.'
      });
      return;
    }

    const isValid = luhnCheck(cleaned);
    const brand = detectCardBrand(cleaned);

    setValidationResult({
      isValid,
      brand,
      message: isValid 
        ? `Valid format! Detected: ${brand?.name || 'Unknown Brand'}`
        : 'Invalid card number (Luhn check failed)'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyAllCards = () => {
    let output = '';
    
    generatedCards.forEach((card, index) => {
      const exp = `${card.expMonth}/${card.expYear}`;
      
      switch (format) {
        case 'pipe':
          output += `${card.number}|${exp}|${card.cvv}`;
          if (index < generatedCards.length - 1) output += '\n';
          break;
        case 'newline':
          output += `${card.number}\n${exp}\n${card.cvv}`;
          if (index < generatedCards.length - 1) output += '\n\n';
          break;
        case 'json':
          // Will handle separately
          break;
      }
    });

    if (format === 'json') {
      output = JSON.stringify(generatedCards.map(c => ({
        number: c.number,
        exp: `${c.expMonth}/${c.expYear}`,
        cvv: c.cvv,
        brand: c.brand?.name
      })), null, 2);
    }

    copyToClipboard(output);
  };

  const reset = () => {
    setGeneratedCards([]);
    setBin('');
    setValidationResult(null);
    setInputNumber('');
    setExpMonth('random');
    setExpYear('random');
    setCustomCVV('');
  };

  return (
    <div className="w-full min-h-screen">
      {/* Hero Section */}
      <div className="text-center pt-8 pb-8 px-4">
        {/* Title Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-cyan-500/30 rounded-full bg-cyan-500/10 text-cyan-400 text-sm font-medium">
          <CreditCard className="w-4 h-4" />
          <span>CC Tools</span>
        </div>
        
        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
            Credit Card
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
            Generator & Validator.
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
          Generate valid test card numbers using the Luhn algorithm.
          <span className="text-white font-medium"> Validate card formats. </span>
          Perfect for testing.
        </p>

        {/* Warning Notice - Prominent */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>For testing purposes only. Do not use for illegal activities.</span>
        </div>
      </div>

      {/* Mode Tabs - Modern Pill Design */}
      <div className="flex justify-center mb-8 px-4">
        <div className="inline-flex p-1.5 bg-gradient-to-br from-[#1a1a2e]/90 to-[#16162a]/95 rounded-2xl border border-white/10 backdrop-blur-sm shadow-lg shadow-black/20">
          <button
            onClick={() => setValidateMode(false)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300
              ${!validateMode 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Zap className="w-4 h-4" />
            Generator
          </button>
          <button
            onClick={() => setValidateMode(true)}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300
              ${validateMode 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Shield className="w-4 h-4" />
            Validator
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {!validateMode ? (
        /* Generator Mode */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:items-start">
          {/* Settings Panel - Compact Width */}
          <div className="lg:col-span-2 bg-gradient-to-b from-cyber-panel to-cyber-dark/50 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="p-2 bg-cyber-primary/10 rounded-lg flex-shrink-0">
                <Settings className="w-4 h-4 text-cyber-primary" />
              </div>
              <h3 className="font-semibold text-white">Configuration</h3>
            </div>

            <div className="space-y-5">
              {/* BIN Input */}
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-medium">BIN Number</label>
                <input
                  type="text"
                  value={bin}
                  onChange={(e) => setBin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 453590"
                  className="w-full bg-cyber-dark/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all placeholder:text-gray-600"
                />
                <p className="text-[11px] text-gray-600 mt-1.5">Leave empty for random Visa</p>
              </div>

              {/* Format */}
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-medium">Output Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full bg-cyber-dark/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all cursor-pointer"
                >
                  <option value="pipe">PIPE (Card | Exp | CVV)</option>
                  <option value="newline">Newline</option>
                  <option value="json">JSON</option>
                </select>
              </div>

              {/* Expiration Month & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-medium">Month</label>
                  <select
                    value={expMonth}
                    onChange={(e) => setExpMonth(e.target.value)}
                    className="w-full bg-cyber-dark/80 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all cursor-pointer"
                  >
                    <option value="random">Random</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-medium">Year</label>
                  <select
                    value={expYear}
                    onChange={(e) => setExpYear(e.target.value)}
                    className="w-full bg-cyber-dark/80 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all cursor-pointer"
                  >
                    <option value="random">Random</option>
                    {yearOptions.map(year => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CVV Input */}
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-medium">CVV</label>
                <input
                  type="text"
                  value={customCVV}
                  onChange={(e) => setCustomCVV(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Random if empty"
                  className="w-full bg-cyber-dark/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all placeholder:text-gray-600"
                  maxLength={4}
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 mb-2 block font-medium">Quantity</label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="w-full bg-cyber-dark/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all cursor-pointer"
                >
                  <option value="5">5 cards</option>
                  <option value="10">10 cards</option>
                  <option value="25">25 cards</option>
                  <option value="50">50 cards</option>
                  <option value="100">100 cards</option>
                </select>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateCards}
                disabled={isGenerating}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                Generate Cards
              </button>
            </div>
          </div>

          {/* Results Panel - Wider */}
          <div className="lg:col-span-3 bg-gradient-to-b from-cyber-panel to-cyber-dark/50 border border-white/10 rounded-2xl p-6 lg:min-h-[580px] flex flex-col backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyber-primary/10 rounded-lg flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-cyber-primary" />
                </div>
                <h3 className="font-semibold text-white">Generated Cards</h3>
                {generatedCards.length > 0 && (
                  <span className="text-xs bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 px-2.5 py-1 rounded-full font-medium border border-cyan-500/20">
                    {generatedCards.length}
                  </span>
                )}
              </div>
              {generatedCards.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={copyAllCards}
                    className="text-xs px-4 py-2 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 font-medium"
                  >
                    Copy All
                  </button>
                  <button
                    onClick={reset}
                    className="text-xs px-4 py-2 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200 font-medium"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {generatedCards.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                  <div className="p-4 bg-white/5 rounded-2xl mb-4">
                    <CreditCard className="w-10 h-10 opacity-40" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">No cards generated yet</p>
                  <p className="text-xs text-gray-600 mt-1">Configure settings and click Generate</p>
                </div>
              ) : (
                generatedCards.map((card, index) => (
                  <div
                    key={index}
                    className="group bg-cyber-dark/60 border border-white/5 rounded-xl p-4 hover:border-cyber-primary/30 hover:bg-cyber-dark/80 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-lg flex items-center justify-center border border-white/5 flex-shrink-0">
                          <span className="text-lg">{card.brand?.icon || '💳'}</span>
                        </div>
                        <div>
                          <p className="text-white font-mono text-sm tracking-wide">{card.formattedNumber}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                              {card.brand?.name || 'Unknown'}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-[11px] text-gray-500">{card.expMonth}/{card.expYear}</span>
                            <span className="text-gray-600">•</span>
                            <span className="text-[11px] text-gray-500">CVV: {card.cvv}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${card.number}|${card.expMonth}/${card.expYear}|${card.cvv}`)}
                        className="p-2.5 text-gray-500 hover:text-cyber-primary bg-white/0 hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Validator Mode */
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-b from-cyber-panel to-cyber-dark/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/5">
              <div className="p-2.5 bg-cyber-primary/10 rounded-lg flex-shrink-0">
                <Shield className="w-5 h-5 text-cyber-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Luhn Validator</h3>
                <p className="text-gray-500 text-sm mt-0.5">Check card number format validity</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={inputNumber}
                  onChange={(e) => {
                    let value = e.target.value;
                    // If pasted data contains pipe separator (card|exp|cvv), extract only card number
                    if (value.includes('|')) {
                      value = value.split('|')[0];
                    }
                    setInputNumber(value.replace(/[^0-9\s]/g, ''));
                  }}
                  placeholder="Enter card number to validate"
                  className="flex-1 bg-cyber-dark/80 border border-white/10 rounded-xl px-5 py-4 text-white text-sm outline-none focus:border-cyber-primary/50 focus:ring-2 focus:ring-cyber-primary/20 transition-all placeholder:text-gray-600 font-mono tracking-wider"
                />
                <button
                  onClick={validateCard}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Validate
                </button>
              </div>

              {validationResult && (
                <div className={`p-5 rounded-xl border backdrop-blur-sm ${
                  validationResult.isValid 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${validationResult.isValid ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      {validationResult.isValid ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className={`font-semibold ${validationResult.isValid ? 'text-emerald-300' : 'text-red-300'}`}>
                        {validationResult.isValid ? 'Valid Format' : 'Invalid Format'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{validationResult.message}</p>
                      {validationResult.brand && (
                        <span className="inline-block text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-md mt-2">
                          Brand: {validationResult.brand.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-5 bg-cyber-dark/40 rounded-xl border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyber-primary"></div>
                  <h4 className="text-sm font-medium text-gray-300">About Luhn Validation</h4>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  The Luhn algorithm (also known as the "modulus 10" algorithm) is a checksum formula used to validate 
                  identification numbers like credit card numbers. It detects single-digit errors and transposition errors.
                  Note: Passing Luhn validation only means the number follows the correct mathematical format - 
                  it does NOT mean the card is real or active.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
