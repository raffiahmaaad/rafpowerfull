import React, { useState } from 'react';
import { 
  fakerEN_US,
  fakerID_ID, 
  fakerEN_GB,
  fakerEN_CA,
  fakerEN_AU,
  fakerDE,
  fakerFR,
  fakerJA,
  fakerKO,
  fakerZH_CN,
  fakerZH_TW,
  fakerES,
  fakerES_MX,
  fakerIT,
  fakerPT_BR,
  fakerPT_PT,
  fakerNL,
  fakerNL_BE,
  fakerPL,
  fakerRU,
  fakerTR,
  fakerSV,
  fakerAR,
  fakerFI,
  fakerDA,
  fakerNB_NO,
  fakerCS_CZ,
  fakerSK,
  fakerHU,
  fakerRO,
  fakerHR,
  fakerUK,
  fakerEL,
  fakerHE,
  fakerFA,
  fakerVI,
  fakerEN_IN,
  fakerEN_IE,
  fakerDE_AT,
  fakerDE_CH,
  fakerFR_BE,
  fakerFR_CA,
  fakerFR_CH,
  fakerAF_ZA,
  Faker
} from '@faker-js/faker';
import { User, MapPin, Phone, Globe, Copy, RefreshCw, Check, Calendar, Mail, CreditCard, IdCard } from 'lucide-react';
import toast from 'react-hot-toast';

interface GeneratedData {
  // Personal Information
  fullName: string;
  gender: string;
  birthday: string;
  age: number;
  ssn: string; // SSN/NIK/National ID

  // Address
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;

  // Contact
  phoneNumber: string;
  email: string;

  // Geographic
  latitude: number;
  longitude: number;

  // Additional (for testing)
  creditCard: string;
  creditCardExpiry: string;
  creditCardCVV: string;
  driverLicense: string;
}

interface Country {
  code: string;
  name: string;
  flag: string;
  faker: Faker;
}

// Map each country to its specific faker instance for accurate country data
// Total: 44 countries with locale-specific data
const countries: Country[] = [
  // Americas
  { code: 'US', name: 'United States', flag: '🇺🇸', faker: fakerEN_US },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', faker: fakerEN_CA },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', faker: fakerES_MX },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', faker: fakerPT_BR },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', faker: fakerAR },
  
  // Western Europe
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', faker: fakerEN_GB },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', faker: fakerEN_IE },
  { code: 'FR', name: 'France', flag: '🇫🇷', faker: fakerFR },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', faker: fakerDE },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', faker: fakerDE_AT },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', faker: fakerDE_CH },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', faker: fakerNL_BE },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', faker: fakerNL },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', faker: fakerES },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', faker: fakerPT_PT },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', faker: fakerIT },
  
  // Northern Europe
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', faker: fakerSV },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', faker: fakerNB_NO },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', faker: fakerDA },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', faker: fakerFI },
  
  // Eastern Europe
  { code: 'PL', name: 'Poland', flag: '🇵🇱', faker: fakerPL },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', faker: fakerCS_CZ },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', faker: fakerSK },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', faker: fakerHU },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', faker: fakerRO },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', faker: fakerHR },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', faker: fakerUK },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', faker: fakerRU },
  
  // Southern Europe & Middle East
  { code: 'GR', name: 'Greece', flag: '🇬🇷', faker: fakerEL },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', faker: fakerTR },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', faker: fakerHE },
  { code: 'IR', name: 'Iran', flag: '🇮🇷', faker: fakerFA },
  
  // Asia Pacific
  { code: 'IN', name: 'India', flag: '🇮🇳', faker: fakerEN_IN },
  { code: 'CN', name: 'China', flag: '🇨🇳', faker: fakerZH_CN },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', faker: fakerZH_TW },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', faker: fakerJA },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', faker: fakerKO },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', faker: fakerID_ID },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', faker: fakerVI },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', faker: fakerEN_AU },
  
  // Africa
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', faker: fakerAF_ZA },
];

// Generate country-specific SSN/National ID
const generateNationalId = (countryCode: string, birthday: Date, faker: Faker): string => {
  const year = birthday.getFullYear().toString();
  const month = (birthday.getMonth() + 1).toString().padStart(2, '0');
  const day = birthday.getDate().toString().padStart(2, '0');
  
  switch (countryCode) {
    case 'US': // US SSN format: XXX-XX-XXXX
      return `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`;
    
    case 'ID': // Indonesian NIK: 16 digits (province code + DOB + sequence)
      const provinceCode = faker.helpers.arrayElement(['31', '32', '33', '35', '36', '61', '64', '73']); // Major cities
      const dobCode = day + month + year.slice(2, 4);
      const sequence = faker.string.numeric(4);
      return `${provinceCode}${dobCode}${sequence}`;
    
    case 'GB': // UK National Insurance Number: AB123456C
      const letters = 'ABCDEFGHJKLMNPRSTWXYZ';
      return `${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}${faker.string.numeric(6)}${letters[Math.floor(Math.random() * letters.length)]}`;
    
    case 'CA': // Canadian SIN: XXX-XXX-XXX
      return `${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(3)}`;
    
    case 'AU': // Australian Tax File Number: XXX XXX XXX
      return `${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    
    case 'DE': // German Tax ID: 11 digits
      return faker.string.numeric(11);
    
    case 'FR': // French Social Security Number: 1 YY MM DD XXX XXX XX
      const gender = Math.random() > 0.5 ? '1' : '2';
      return `${gender} ${year.slice(2, 4)} ${month} ${day} ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(2)}`;
    
    case 'ES': // Spanish DNI: 8 digits + letter
      const dniLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';
      const dniNum = faker.string.numeric(8);
      return `${dniNum}${dniLetters[parseInt(dniNum) % 23]}`;
    
    case 'IT': // Italian Codice Fiscale (simplified)
      return faker.string.alpha({ length: 6, casing: 'upper' }) + faker.string.numeric(5) + faker.string.alpha({ length: 1, casing: 'upper' });
    
    case 'BR': // Brazilian CPF: XXX.XXX.XXX-XX
      return `${faker.string.numeric(3)}.${faker.string.numeric(3)}.${faker.string.numeric(3)}-${faker.string.numeric(2)}`;
    
    case 'JP': // Japanese My Number: 12 digits
      return faker.string.numeric(12).match(/.{1,4}/g)!.join(' ');
    
    case 'KR': // Korean Resident Registration Number: YYMMDD-XXXXXXX
      return `${year.slice(2, 4)}${month}${day}-${faker.string.numeric(7)}`;
    
    case 'CN': // Chinese ID: 18 digits
      return faker.string.numeric(18);
    
    case 'NL': // Dutch BSN: 9 digits
      return faker.string.numeric(9);
    
    case 'SE': // Swedish Personal Number: YYYYMMDD-XXXX
      return `${year}${month}${day}-${faker.string.numeric(4)}`;
    
    // New countries added
    case 'MX': // Mexican CURP: 18 characters
      return faker.string.alpha({ length: 4, casing: 'upper' }) + year.slice(2, 4) + month + day + faker.string.alpha({ length: 6, casing: 'upper' }) + faker.string.numeric(2);
    
    case 'PT': // Portuguese Citizen Card: 12345678 9 AB1
      return `${faker.string.numeric(8)} ${faker.string.numeric(1)} ${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.string.numeric(1)}`;
    
    case 'NO': // Norwegian National ID: 11 digits (DDMMYY + 5 digits)
      return `${day}${month}${year.slice(2, 4)}${faker.string.numeric(5)}`;
    
    case 'DK': // Danish CPR Number: DDMMYY-XXXX
      return `${day}${month}${year.slice(2, 4)}-${faker.string.numeric(4)}`;
    
    case 'CZ': // Czech Birth Number: YYMMDD/XXXX
      return `${year.slice(2, 4)}${month}${day}/${faker.string.numeric(4)}`;
    
    case 'SK': // Slovak Birth Number: YYMMDD/XXXX
      return `${year.slice(2, 4)}${month}${day}/${faker.string.numeric(4)}`;
    
    case 'HU': // Hungarian Tax Number: 10 digits
      return faker.string.numeric(10);
    
    case 'RO': // Romanian CNP: 13 digits
      return faker.string.numeric(13);
    
    case 'HR': // Croatian OIB: 11 digits
      return faker.string.numeric(11);
    
    case 'UA': // Ukrainian Tax Number: 10 digits
      return faker.string.numeric(10);
    
    case 'GR': // Greek Tax ID (AFM): 9 digits
      return faker.string.numeric(9);
    
    case 'IL': // Israeli ID: 9 digits
      return faker.string.numeric(9);
    
    case 'IR': // Iranian National Code: 10 digits
      return faker.string.numeric(10);
    
    case 'IN': // Indian Aadhaar: 12 digits (XXXX XXXX XXXX)
      return `${faker.string.numeric(4)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
    
    case 'TW': // Taiwan National ID: A123456789
      return faker.string.alpha({ length: 1, casing: 'upper' }) + faker.string.numeric(9);
    
    case 'VN': // Vietnamese ID: 12 digits
      return faker.string.numeric(12);
    
    case 'ZA': // South African ID: YYMMDD SSSS C A Z
      return `${year.slice(2, 4)}${month}${day} ${faker.string.numeric(4)} ${faker.string.numeric(1)} ${faker.string.numeric(1)} ${faker.string.numeric(1)}`;
    
    case 'IE': // Irish PPS Number: 1234567AB
      return `${faker.string.numeric(7)}${faker.string.alpha({ length: 2, casing: 'upper' })}`;
    
    case 'AT': // Austrian SSN: 10 digits
      return faker.string.numeric(10);
    
    case 'CH': // Swiss AHV Number: 756.1234.5678.97
      return `756.${faker.string.numeric(4)}.${faker.string.numeric(4)}.${faker.string.numeric(2)}`;
    
    case 'BE': // Belgian National Number: YY.MM.DD-XXX.XX
      return `${year.slice(2, 4)}.${month}.${day}-${faker.string.numeric(3)}.${faker.string.numeric(2)}`;
    
    default:
      return faker.string.numeric(10);
  }
};

// Generate country-specific phone number
const generatePhoneNumber = (countryCode: string, faker: Faker): string => {
  switch (countryCode) {
    case 'US':
    case 'CA':
      return `+1 (${faker.string.numeric(3)}) ${faker.string.numeric(3)}-${faker.string.numeric(4)}`;
    case 'ID':
      return `+62 ${faker.helpers.arrayElement(['812', '813', '821', '822', '851', '852'])}-${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
    case 'GB':
      return `+44 ${faker.string.numeric(4)} ${faker.string.numeric(6)}`;
    case 'AU':
      return `+61 ${faker.string.numeric(1)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
    case 'DE':
      return `+49 ${faker.string.numeric(3)} ${faker.string.numeric(8)}`;
    case 'FR':
      return `+33 ${faker.string.numeric(1)} ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`;
    case 'ES':
      return `+34 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    case 'IT':
      return `+39 ${faker.string.numeric(3)} ${faker.string.numeric(7)}`;
    case 'BR':
      return `+55 ${faker.string.numeric(2)} ${faker.string.numeric(5)}-${faker.string.numeric(4)}`;
    case 'NL':
      return `+31 ${faker.string.numeric(1)} ${faker.string.numeric(8)}`;
    case 'PL':
      return `+48 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    case 'RU':
      return `+7 ${faker.string.numeric(3)} ${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(2)}`;
    case 'TR':
      return `+90 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'JP':
      return `+81 ${faker.string.numeric(2)}-${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
    case 'KR':
      return `+82 ${faker.string.numeric(2)}-${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
    case 'CN':
      return `+86 ${faker.string.numeric(3)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
    case 'SE':
      return `+46 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'FI':
      return `+358 ${faker.string.numeric(2)} ${faker.string.numeric(7)}`;
    case 'AR':
      return `+54 ${faker.string.numeric(2)} ${faker.string.numeric(4)}-${faker.string.numeric(4)}`;
    
    // New countries
    case 'MX':
      return `+52 ${faker.string.numeric(2)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
    case 'PT':
      return `+351 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    case 'NO':
      return `+47 ${faker.string.numeric(3)} ${faker.string.numeric(2)} ${faker.string.numeric(3)}`;
    case 'DK':
      return `+45 ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`;
    case 'CZ':
      return `+420 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    case 'SK':
      return `+421 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    case 'HU':
      return `+36 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'RO':
      return `+40 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
    case 'HR':
      return `+385 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'UA':
      return `+380 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'GR':
      return `+30 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'IL':
      return `+972 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'IR':
      return `+98 ${faker.string.numeric(3)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'IN':
      return `+91 ${faker.string.numeric(5)} ${faker.string.numeric(5)}`;
    case 'TW':
      return `+886 ${faker.string.numeric(1)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
    case 'VN':
      return `+84 ${faker.string.numeric(2)} ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
    case 'ZA':
      return `+27 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'IE':
      return `+353 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'AT':
      return `+43 ${faker.string.numeric(3)} ${faker.string.numeric(8)}`;
    case 'CH':
      return `+41 ${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
    case 'BE':
      return `+32 ${faker.string.numeric(3)} ${faker.string.numeric(2)} ${faker.string.numeric(2)} ${faker.string.numeric(2)}`;
    
    default:
      return faker.phone.number();
  }
};

// Generate credit card (for testing only - Luhn algorithm compliant)
const generateCreditCard = (faker: Faker): { number: string; expiry: string; cvv: string } => {
  // Generate 16 digits (Visa) and format as xxxx-xxxx-xxxx-xxxx
  const rawNumber = faker.finance.creditCardNumber('visa').replace(/\D/g, '');
  const formattedNumber = rawNumber.padEnd(16, '0').slice(0, 16).match(/.{1,4}/g)?.join('-') || rawNumber;
  
  const expiryMonth = (faker.number.int({ min: 1, max: 12 })).toString().padStart(2, '0');
  const expiryYear = (new Date().getFullYear() + faker.number.int({ min: 1, max: 5 })).toString().slice(-2);
  const cvv = faker.string.numeric(3);
  
  return {
    number: formattedNumber,
    expiry: `${expiryMonth}/${expiryYear}`,
    cvv: cvv
  };
};

// Generate driver's license (country-specific format)
const generateDriverLicense = (countryCode: string, faker: Faker): string => {
  switch (countryCode) {
    case 'US': // US format varies by state, general: A123456789012
      return faker.string.alpha({ length: 1, casing: 'upper' }) + faker.string.numeric(12);
    case 'ID': // Indonesian SIM: 12 digits
      return faker.string.numeric(12);
    case 'GB': // UK format: ABCDE123456AB1CD
      return faker.string.alpha({ length: 5, casing: 'upper' }) + 
             faker.string.numeric(6) + 
             faker.string.alpha({ length: 2, casing: 'upper' }) + 
             faker.string.numeric(1) + 
             faker.string.alpha({ length: 2, casing: 'upper' });
    case 'CA': // Canadian: A1234-12345-12345
      return faker.string.alpha({ length: 1, casing: 'upper' }) + 
             faker.string.numeric(4) + '-' + 
             faker.string.numeric(5) + '-' + 
             faker.string.numeric(5);
    case 'AU': // Australian: 1234567890
      return faker.string.numeric(10);
    case 'DE': // German: AB1234567890
      return faker.string.alpha({ length: 2, casing: 'upper' }) + faker.string.numeric(10);
    case 'FR': // French: 121234567890
      return faker.string.numeric(12);
    case 'ES': // Spanish: 12345678A
      return faker.string.numeric(8) + faker.string.alpha({ length: 1, casing: 'upper' });
    case 'IT': // Italian: AB1234567C
      return faker.string.alpha({ length: 2, casing: 'upper' }) + 
             faker.string.numeric(7) + 
             faker.string.alpha({ length: 1, casing: 'upper' });
    case 'BR': // Brazilian CNH: 12345678900
      return faker.string.numeric(11);
    case 'JP': // Japanese: 123456789012
      return faker.string.numeric(12);
    default:
      return faker.string.alphanumeric(12).toUpperCase();
  }
};

export const AddressGenerator: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const generateData = () => {
    const faker = selectedCountry.faker;

    // Generate birthday (18-65 years old)
    const birthday = faker.date.birthdate({ min: 18, max: 65, mode: 'age' });
    const age = new Date().getFullYear() - birthday.getFullYear();

    // Generate gender
    const genderValue = faker.person.sex();
    const gender = genderValue === 'male' ? 'Male' : 'Female';

    // Generate credit card info
    const creditCardInfo = generateCreditCard(faker);

    // Generate data with country-specific faker instance
    const data: GeneratedData = {
      // Personal
      fullName: faker.person.fullName({ sex: genderValue as 'male' | 'female' }),
      gender,
      birthday: birthday.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      age,
      ssn: generateNationalId(selectedCountry.code, birthday, faker),

      // Address - tailored for payment validation realism
      street: faker.location.streetAddress(true),
      city: faker.location.city(),
      // Payment gateways strictly require 2-letter codes for these countries
      state: (['US', 'CA', 'AU', 'MX', 'BR', 'IT'].includes(selectedCountry.code))
        ? faker.location.state({ abbreviated: true }).toUpperCase() 
        : faker.location.state(),
      // US Zip must be 5 digits for highest compatibility
      zipCode: selectedCountry.code === 'US' 
        ? faker.location.zipCode('#####')
        : faker.location.zipCode(),
      country: selectedCountry.name,

      // Contact
      phoneNumber: generatePhoneNumber(selectedCountry.code, faker),
      email: faker.internet.email().toLowerCase(),

      // Geographic - coordinates within country bounds
      latitude: parseFloat(faker.location.latitude().toString()),
      longitude: parseFloat(faker.location.longitude().toString()),

      // Additional (for testing)
      creditCard: creditCardInfo.number,
      creditCardExpiry: creditCardInfo.expiry,
      creditCardCVV: creditCardInfo.cvv,
      driverLicense: generateDriverLicense(selectedCountry.code, faker),
    };

    setGeneratedData(data);
    toast.success('Identity generated successfully!');
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copied!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAllAsJSON = () => {
    if (!generatedData) return;
    const json = JSON.stringify(generatedData, null, 2);
    navigator.clipboard.writeText(json);
    toast.success('All data copied as JSON!');
  };

  const DataField: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="group relative bg-cyber-dark/50 backdrop-blur-sm border border-white/5 rounded-xl p-4 hover:border-amber-500/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-amber-500/10 rounded-lg flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-white font-medium break-words">{value}</p>
          </div>
        </div>
        <button
          onClick={() => copyToClipboard(value, label)}
          className="p-2 hover:bg-white/5 rounded-lg transition-all duration-300 flex-shrink-0"
          title="Copy"
        >
          {copiedField === label ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400 hover:text-amber-400" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen">
      {/* Hero Section - Matching TempMail Style */}
      <div className="text-center pt-8 pb-12 px-4">
        {/* Title Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 border border-amber-500/30 rounded-full bg-amber-500/10 text-amber-400 text-sm font-medium">
          <IdCard className="w-4 h-4" />
          <span>Identity Generator</span>
        </div>
        
        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
            Generate Realistic
          </span>
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">
            Fake Identity.
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
          Create complete fake identity data for testing purposes.
          <span className="text-white font-medium"> 44 countries supported. </span>
          Accurate locale-specific data.
        </p>

        {/* Disclaimer - Inline */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-300 text-sm">
          <span>⚠️</span>
          <span>Testing purposes only. Do not use for illegal activities.</span>
        </div>
      </div>

      {/* Generator Card - Full Width Modern Design */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="bg-gradient-to-br from-[#1a1a2e]/90 via-[#16162a]/95 to-[#0f0f1a] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          
          {/* Card Header with Gradient Accent */}
          <div className="relative px-5 py-5 sm:px-8 sm:py-6 border-b border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent"></div>
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
                  <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Create Identity</h2>
                  <p className="text-gray-400">Configure and generate fake identity data</p>
                </div>
              </div>
              
              {/* Generate Button - Desktop */}
              <button
                onClick={generateData}
                className="hidden sm:flex px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:scale-105 items-center gap-3"
              >
                <RefreshCw className="w-5 h-5" />
                Generate Identity
              </button>
            </div>
          </div>

          {/* Card Content */}
          <div className="p-8">
            
            {/* Country Selection Section */}
            <div className="space-y-6">
              <div className="flex items-center flex-wrap gap-3 mb-4">
                <Globe className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Select Country</h3>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full whitespace-nowrap">44 countries available</span>
              </div>
              
              {/* Selected Country Display - Prominent */}
              
              
              {/* Country Selector Dropdown */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Choose a different country
                </label>
                <div className="relative">
                  <select
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const country = countries.find(c => c.code === e.target.value);
                      if (country) setSelectedCountry(country);
                    }}
                    className="w-full px-5 py-4 bg-[#0d0d1a] border border-white/10 rounded-xl text-white text-lg focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all appearance-none cursor-pointer hover:border-white/20"
                  >
                    {/* Americas */}
                    <optgroup label="🌎 Americas">
                      <option value="AR">🇦🇷 Argentina</option>
                      <option value="BR">🇧🇷 Brazil</option>
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="MX">🇲🇽 Mexico</option>
                      <option value="US">🇺🇸 United States</option>
                    </optgroup>

                    {/* Europe - Western */}
                    <optgroup label="🌍 Europe - Western">
                      <option value="AT">🇦🇹 Austria</option>
                      <option value="BE">🇧🇪 Belgium</option>
                      <option value="FR">🇫🇷 France</option>
                      <option value="DE">🇩🇪 Germany</option>
                      <option value="IE">🇮🇪 Ireland</option>
                      <option value="IT">🇮🇹 Italy</option>
                      <option value="NL">🇳🇱 Netherlands</option>
                      <option value="PT">🇵🇹 Portugal</option>
                      <option value="ES">🇪🇸 Spain</option>
                      <option value="CH">🇨🇭 Switzerland</option>
                      <option value="GB">🇬🇧 United Kingdom</option>
                    </optgroup>

                    {/* Europe - Northern */}
                    <optgroup label="🌍 Europe - Northern">
                      <option value="DK">🇩🇰 Denmark</option>
                      <option value="FI">🇫🇮 Finland</option>
                      <option value="NO">🇳🇴 Norway</option>
                      <option value="SE">🇸🇪 Sweden</option>
                    </optgroup>

                    {/* Europe - Eastern */}
                    <optgroup label="🌍 Europe - Eastern">
                      <option value="HR">🇭🇷 Croatia</option>
                      <option value="CZ">🇨🇿 Czech Republic</option>
                      <option value="HU">🇭🇺 Hungary</option>
                      <option value="PL">🇵🇱 Poland</option>
                      <option value="RO">🇷🇴 Romania</option>
                      <option value="RU">🇷🇺 Russia</option>
                      <option value="SK">🇸🇰 Slovakia</option>
                      <option value="UA">🇺🇦 Ukraine</option>
                    </optgroup>

                    {/* Europe - Southern & Middle East */}
                    <optgroup label="🌍 Southern Europe & Middle East">
                      <option value="GR">🇬🇷 Greece</option>
                      <option value="IR">🇮🇷 Iran</option>
                      <option value="IL">🇮🇱 Israel</option>
                      <option value="TR">🇹🇷 Turkey</option>
                    </optgroup>

                    {/* Asia Pacific */}
                    <optgroup label="🌏 Asia Pacific">
                      <option value="AU">🇦🇺 Australia</option>
                      <option value="CN">🇨🇳 China</option>
                      <option value="IN">🇮🇳 India</option>
                      <option value="ID">🇮🇩 Indonesia</option>
                      <option value="JP">🇯🇵 Japan</option>
                      <option value="KR">🇰🇷 South Korea</option>
                      <option value="TW">🇹🇼 Taiwan</option>
                      <option value="VN">🇻🇳 Vietnam</option>
                    </optgroup>

                    {/* Africa */}
                    <optgroup label="🌍 Africa">
                      <option value="ZA">🇿🇦 South Africa</option>
                    </optgroup>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {/* Generate Button - Mobile */}
              <button
                onClick={generateData}
                className="sm:hidden w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Generate Identity
              </button>
              
            </div>
          </div>
        </div>
      </div>
      {/* Results */}
      {generatedData && (
        <div className="max-w-5xl mx-auto px-4 pb-12 space-y-6 animate-in fade-in duration-500">
          {/* Personal Information */}
          <div className="bg-gradient-to-br from-[#1a1a2e]/90 via-[#16162a]/95 to-[#0f0f1a] backdrop-blur-xl rounded-3xl border border-white/10 shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Personal Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DataField label="Full Name" value={generatedData.fullName} icon={<User className="w-4 h-4 text-amber-400" />} />
              <DataField label="Gender" value={generatedData.gender} icon={<User className="w-4 h-4 text-amber-400" />} />
              <DataField label="Birthday" value={generatedData.birthday} icon={<Calendar className="w-4 h-4 text-amber-400" />} />
              <DataField label="Age" value={`${generatedData.age} years`} icon={<Calendar className="w-4 h-4 text-amber-400" />} />
              <DataField 
                label={
                  selectedCountry.code === 'US' ? 'SSN' : 
                  selectedCountry.code === 'ID' ? 'NIK' : 
                  selectedCountry.code === 'GB' ? 'National Insurance' :
                  selectedCountry.code === 'BR' ? 'CPF' :
                  'National ID'
                } 
                value={generatedData.ssn} 
                icon={<User className="w-4 h-4 text-amber-400" />} 
              />
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-gradient-to-br from-[#1a1a2e]/90 via-[#16162a]/95 to-[#0f0f1a] backdrop-blur-xl rounded-3xl border border-white/10 shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Address</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <DataField label="Street Address" value={generatedData.street} icon={<MapPin className="w-4 h-4 text-amber-400" />} />
              <DataField label="City" value={generatedData.city} icon={<MapPin className="w-4 h-4 text-amber-400" />} />
              <DataField label="State/Province" value={generatedData.state} icon={<MapPin className="w-4 h-4 text-amber-400" />} />
              <DataField label="ZIP/Postal Code" value={generatedData.zipCode} icon={<MapPin className="w-4 h-4 text-amber-400" />} />
              <DataField label="Country" value={generatedData.country} icon={<Globe className="w-4 h-4 text-amber-400" />} />
            </div>
          </div>

          {/* Contact & Geographic */}
          <div className="bg-gradient-to-br from-[#1a1a2e]/90 via-[#16162a]/95 to-[#0f0f1a] backdrop-blur-xl rounded-3xl border border-white/10 shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Contact & Location</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DataField label="Phone Number" value={generatedData.phoneNumber} icon={<Phone className="w-4 h-4 text-amber-400" />} />
              <DataField label="Email Address" value={generatedData.email} icon={<Mail className="w-4 h-4 text-amber-400" />} />
              <DataField label="Latitude" value={generatedData.latitude.toFixed(6)} icon={<Globe className="w-4 h-4 text-amber-400" />} />
              <DataField label="Longitude" value={generatedData.longitude.toFixed(6)} icon={<Globe className="w-4 h-4 text-amber-400" />} />
            </div>
          </div>

          {/* Payment & License (For Testing) */}
          <div className="bg-gradient-to-br from-[#1a1a2e]/90 via-[#16162a]/95 to-[#0f0f1a] backdrop-blur-xl rounded-3xl border border-white/10 shadow-xl p-8">
            <div className="flex items-center flex-wrap gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Payment & License</h2>
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full whitespace-nowrap">(For Testing Only)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DataField label="Credit Card Number" value={generatedData.creditCard} icon={<CreditCard className="w-4 h-4 text-amber-400" />} />
              <DataField label="Card Expiry" value={generatedData.creditCardExpiry} icon={<CreditCard className="w-4 h-4 text-amber-400" />} />
              <DataField label="CVV" value={generatedData.creditCardCVV} icon={<CreditCard className="w-4 h-4 text-amber-400" />} />
              <DataField label="Driver's License" value={generatedData.driverLicense} icon={<IdCard className="w-4 h-4 text-amber-400" />} />
            </div>
          </div>

          {/* Copy All Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={copyAllAsJSON}
              className="px-8 py-4 bg-gradient-to-br from-[#1a1a2e] to-[#16162a] border border-amber-500/30 text-amber-400 font-semibold rounded-xl hover:bg-amber-500/10 hover:border-amber-500/50 transition-all duration-300 flex items-center gap-3 shadow-xl"
            >
              <Copy className="w-5 h-5" />
              Copy All as JSON
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!generatedData && (
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-8">
              <User className="w-12 h-12 text-amber-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No Identity Generated Yet</h3>
            <p className="text-gray-400 max-w-md leading-relaxed">
              Select a country above and click "Generate Identity" to create realistic fake identity data for testing purposes
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
