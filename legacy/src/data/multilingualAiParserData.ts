/**
 * Multilingual AI Parser Demonstration Dataset
 * 
 * Provides authentic, professionally translated procurement requirement prompts
 * and matching structured draft outputs across all 8 supported Indian languages:
 * 1. English (en)
 * 2. Hindi (hi)
 * 3. Tamil (ta)
 * 4. Telugu (te)
 * 5. Marathi (mr)
 * 6. Bengali (bn)
 * 7. Gujarati (gu)
 * 8. Kannada (kn)
 * 
 * Sourced to maintain 100% semantic parity with canonical English procurement terminology:
 * "We need custom packaging for an upcoming product launch, with a premium finish, a protective insert, and a specific delivery deadline."
 */

export interface MultilingualDemoField {
  label: string
  value: string
}

export interface MultilingualDemoItem {
  code: string
  languageName: string
  nativeName: string
  inputBadge: string
  parserStatus: string
  inputPrompt: string
  outputBadge: string
  outputStatus: string
  fields: MultilingualDemoField[]
}

export const MULTILINGUAL_AI_PARSER_DEMO_DATA: MultilingualDemoItem[] = [
  // 1. English
  {
    code: "en",
    languageName: "English",
    nativeName: "English",
    inputBadge: "INPUT: Raw Natural Language Prompt",
    parserStatus: "● AI PARSER READY",
    inputPrompt: '"We need custom packaging for an upcoming product launch, with a premium finish, a protective insert, and a specific delivery deadline."',
    outputBadge: "STRUCTURED REQUEST DRAFT",
    outputStatus: "Draft Preview • Not Dispatched",
    fields: [
      { label: "Product requirements:", value: "Custom rigid packaging box" },
      { label: "Quantity and specifications:", value: "500 units target batch" },
      { label: "Materials and customization:", value: "Premium finish, protective insert" },
      { label: "Delivery requirements:", value: "Specified launch deadline" },
      { label: "Missing details to confirm:", value: "Exact dimensions, print artwork files" },
    ],
  },

  // 2. Hindi (हिन्दी)
  {
    code: "hi",
    languageName: "Hindi",
    nativeName: "हिन्दी (Hindi)",
    inputBadge: "इनपुट: सामान्य भाषा आवश्यकता",
    parserStatus: "● AI पार्सर तैयार",
    inputPrompt: '"हमें आगामी उत्पाद लॉन्च के लिए प्रीमियम फिनिश, सुरक्षात्मक इंसर्ट और एक निश्चित डिलीवरी समय-सीमा के साथ कस्टम पैकेजिंग की आवश्यकता है।"',
    outputBadge: "संरचित आवश्यकता ड्राफ्ट",
    outputStatus: "ड्राफ्ट पूर्वावलोकन • भेजा नहीं गया",
    fields: [
      { label: "उत्पाद आवश्यकताएँ:", value: "कस्टम रिजिड पैकेजिंग बॉक्स" },
      { label: "मात्रा और विनिर्देश:", value: "500 यूनिट्स लक्षित बैच" },
      { label: "सामग्री और कस्टमाइज़ेशन:", value: "प्रीमियम फिनिश, सुरक्षात्मक इंसर्ट" },
      { label: "डिलीवरी आवश्यकताएँ:", value: "निर्दिष्ट लॉन्च समय-सीमा" },
      { label: "पुष्टि के लिए शेष विवरण:", value: "सटीक आयाम (Dimensions), प्रिंट आर्टवर्क फाइलें" },
    ],
  },

  // 3. Tamil (தமிழ்)
  {
    code: "ta",
    languageName: "Tamil",
    nativeName: "தமிழ் (Tamil)",
    inputBadge: "உள்ளீடு: இயல்பு மொழி கோரிக்கை",
    parserStatus: "● AI பாகுபடுத்தி தயார்",
    inputPrompt: '"எங்களின் புதிய தயாரிப்பு அறிமுகத்திற்காக பிரீமியம் ஃபினிஷிங், பாதுகாப்பு உறை மற்றும் குறிப்பிட்ட டெலிவரி காலக்கெடுவுடன் கூடிய தனிப்பயன் பேக்கேஜிங் தேவைப்படுகிறது."',
    outputBadge: "கட்டமைக்கப்பட்ட கோரிக்கை வரைவு",
    outputStatus: "வரைவு முன்னோட்டம் • அனுப்பப்படவில்லை",
    fields: [
      { label: "தயாரிப்பு தேவைகள்:", value: "தனிப்பயன் ரிஜிட் பேக்கேஜிங் பெட்டி" },
      { label: "அளவு மற்றும் விவரக்குறிப்புகள்:", value: "500 யூனிட்டுகள் இலக்கு தொகுதி" },
      { label: "பொருட்கள் மற்றும் தனிப்பயனாக்கம்:", value: "பிரீமியம் ஃபினிஷிங், பாதுகாப்பு உறை" },
      { label: "டெலிவரி தேவைகள்:", value: "குறிப்பிடப்பட்ட அறிமுக காலக்கெடு" },
      { label: "உறுதிப்படுத்த வேண்டிய விவரங்கள்:", value: "துல்லியமான பரிமாணங்கள், அச்சு வடிவமைப்பு கோப்புகள்" },
    ],
  },

  // 4. Telugu (తెలుగు)
  {
    code: "te",
    languageName: "Telugu",
    nativeName: "తెలుగు (Telugu)",
    inputBadge: "ఇన్‌పుట్: సహజ భాషా ప్రాంప్ట్",
    parserStatus: "● AI పార్సర్ సిద్ధంగా ఉంది",
    inputPrompt: '"రాబోయే ప్రోడక్ట్ లాంచ్ కోసం ప్రీమియం ఫినిషింగ్, రక్షిత ఇన్సర్ట్ మరియు నిర్దిష్ట డెలివరీ గడువుతో మాకు కస్టమ్ ప్యాకేజింగ్ అవసరం."',
    outputBadge: "నిర్మాణాత్మక రిక్వెస్ట్ డ్రాఫ్ట్",
    outputStatus: "డ్రాఫ్ట్ ప్రివ్యూ • పంపబడలేదు",
    fields: [
      { label: "ఉత్పత్తి అవసరాలు:", value: "కస్టమ్ రిజిడ్ ప్యాకేజింగ్ బాక్స్" },
      { label: "పరిమాణం మరియు వివరాలు:", value: "500 యూనిట్ల లక్ష్య బ్యాచ్" },
      { label: "మెటీరియల్స్ & అనుకూలీకరణ:", value: "ప్రీమియం ఫినిష్, రక్షిత ఇన్సర్ట్" },
      { label: "డెలివరీ అవసరాలు:", value: "పేర్కొన్న లాంచ్ గడువు" },
      { label: "ధృవీకరించాల్సిన వివరాలు:", value: "ఖచ్చితమైన కొలతలు, ప్రింట్ ఆర్ట్‌వర్క్ ఫైళ్లు" },
    ],
  },

  // 5. Marathi (मराठी)
  {
    code: "mr",
    languageName: "Marathi",
    nativeName: "मराठी (Marathi)",
    inputBadge: "इनपुट: नैसर्गिक भाषा प्रॉम्प्ट",
    parserStatus: "● AI पार्सर सज्ज",
    inputPrompt: '"आगामी उत्पादन लाँचसाठी आम्हाला प्रीमियम फिनिश, संरक्षणात्मक इन्सर्ट आणि निश्चित डिलिव्हरी मुदतीसह सानुकूल (कस्टम) पॅकेजिंग आवश्यक आहे."',
    outputBadge: "संरचित विनंती मसुदा",
    outputStatus: "मसुदा पूर्वावलोकन • पाठवलेला नाही",
    fields: [
      { label: "उत्पाद आवश्यकता:", value: "कस्टम रिजिड पॅकेजिंग बॉक्स" },
      { label: "प्रमाण आणि तपशील:", value: "500 युनिट्स लक्ष्यित बॅच" },
      { label: "साहित्य आणि कस्टमायझेशन:", value: "प्रीमियम फिनिश, संरक्षणात्मक इन्सर्ट" },
      { label: "डिलिव्हरी आवश्यकता:", value: "निर्दिष्ट लाँच मुदत" },
      { label: "पुष्टीसाठी उर्वरित तपशील:", value: "अचूक आकारमान (Dimensions), प्रिंट आर्टवर्क फाइल्स" },
    ],
  },

  // 6. Bengali (বাংলা)
  {
    code: "bn",
    languageName: "Bengali",
    nativeName: "বাংলা (Bengali)",
    inputBadge: "ইনপুট: স্বাভাবিক ভাষা প্রম্পট",
    parserStatus: "● AI পার্সার প্রস্তুত",
    inputPrompt: '"আসন্ন পণ্য লঞ্চের জন্য আমাদের প্রিমিয়াম ফিনিশ, সুরক্ষামূলক ইনসার্ট এবং নির্দিষ্ট ডেলিভারি সময়সীমা সহ কাস্টম প্যাকেজিং প্রয়োজন।"',
    outputBadge: "কাঠামোগত রিকোয়েস্ট ড্রাফ্ট",
    outputStatus: "ড্রাফ্ট পূর্বরূপ • পাঠানো হয়নি",
    fields: [
      { label: "পণ্যের প্রয়োজনীয়তা:", value: "কাস্টম রিজিড প্যাকেজিং বক্স" },
      { label: "পরিমাণ ও বিবরণ:", value: "500 ইউনিট টার্গেট ব্যাচ" },
      { label: "উপাদান ও কাস্টমাইজেশন:", value: "প্রিমিয়াম ফিনিশ, সুরক্ষামূলক ইনসার্ট" },
      { label: "ডেলিভারির প্রয়োজনীয়তা:", value: "নির্দিষ্ট লঞ্চের সময়সীমা" },
      { label: "নিশ্চিত করার বাকি বিবরণ:", value: "সঠিক মাত্রা (Dimensions), প্রিন্ট আর্টওয়ার্ক ফাইল" },
    ],
  },

  // 7. Gujarati (ગુજરાતી)
  {
    code: "gu",
    languageName: "Gujarati",
    nativeName: "ગુજરાતી (Gujarati)",
    inputBadge: "ઇનપુટ: સામાન્ય ભાષા પ્રોમ્પ્ટ",
    parserStatus: "● AI પાર્સર તૈયાર",
    inputPrompt: '"આગામી પ્રોડક્ટ લૉન્ચ માટે અમને પ્રીમિયમ ફિનિશ, સુરક્ષાત્મક ઇન્સર્ટ અને નિર્ધારિત ડિલિવરી સમયમર્યાદા સાથે કસ્ટમ પેકેજિંગની જરૂર છે."',
    outputBadge: "સંરચિત રિક્વેસ્ટ ડ્રાફ્ટ",
    outputStatus: "ડ્રાફ્ટ પૂર્વાવલોકન • મોકલાયેલ નથી",
    fields: [
      { label: "ઉત્પાદન જરૂરિયાતો:", value: "કસ્ટમ રિજિડ પેકેજિંગ બૉક્સ" },
      { label: "જથ્થો અને વિશિષ્ટતાઓ:", value: "500 યુનિટ્સ લક્ષ્યાંક બેચ" },
      { label: "મટિરિયલ અને કસ્ટમાઇઝેશન:", value: "પ્રીમિયમ ફિનિશ, સુરક્ષાત્મક ઇન્સર્ટ" },
      { label: "ડિલિવરી જરૂરિયાતો:", value: "નિર્દિષ્ટ લૉન્ચ સમયમર્યાદા" },
      { label: "પુષ્ટિ માટે વિગતો:", value: "ચોક્કસ માપ (Dimensions), પ્રિન્ટ આર્ટવર્ક ફાઇલો" },
    ],
  },

  // 8. Kannada (ಕನ್ನಡ)
  {
    code: "kn",
    languageName: "Kannada",
    nativeName: "ಕನ್ನಡ (Kannada)",
    inputBadge: "ಇನ್‌ಪುಟ್: ನೈಸರ್ಗಿಕ ಭಾಷಾ ಪ್ರಾಂಪ್ಟ್",
    parserStatus: "● AI ಪಾರ್ಸರ್ ಸಿದ್ಧವಾಗಿದೆ",
    inputPrompt: '"ಮುಂಬರುವ ಉತ್ಪನ್ನ ಬಿಡುಗಡೆಗಾಗಿ ನಮಗೆ ಪ್ರೀಮಿಯಂ ಫಿನಿಶ್, ರಕ್ಷಣಾತ್ಮಕ ಇನ್ಸರ್ಟ್ ಮತ್ತು ನಿರ್ದಿಷ್ಟ ವಿತರಣಾ ಗಡುವಿನೊಂದಿಗೆ ಕಸ್ಟಮ್ ಪ್ಯಾಕೇಜಿಂಗ್ ಅಗತ್ಯವಿದೆ."',
    outputBadge: "ರಚನಾತ್ಮಕ ವಿನಂತಿ ಕರಡು",
    outputStatus: "ಕರಡು ಪೂರ್ವವೀಕ್ಷಣೆ • ರವಾನಿಸಲಾಗಿಲ್ಲ",
    fields: [
      { label: "ಉತ್ಪನ್ನದ ಅವಶ್ಯಕತೆಗಳು:", value: "ಕಸ್ಟಮ್ ರಿಜಿಡ್ ಪ್ಯಾಕೇಜಿಂಗ್ ಬಾಕ್ಸ್" },
      { label: "ಪ್ರಮಾಣ ಮತ್ತು ವಿಶೇಷಣಗಳು:", value: "500 ಯೂನಿಟ್‌ಗಳ ಗುರಿ ಬ್ಯಾಚ್" },
      { label: "ವಸ್ತುಗಳು ಮತ್ತು ಗ್ರಾಹಕೀಕರಣ:", value: "ಪ್ರೀಮಿಯಂ ಫಿನಿಶ್, ರಕ್ಷಣಾತ್ಮಕ ಇನ್ಸರ್ಟ್" },
      { label: "ವಿತರಣಾ ಅವಶ್ಯಕತೆಗಳು:", value: "ನಿರ್ದಿಷ್ಟ ಬಿಡುಗಡೆ ಗಡುವು" },
      { label: "ದೃಢೀಕರಿಸಬೇಕಾದ ವಿವರಗಳು:", value: "ನಿಖರ ಆಯಾಮಗಳು, ಮುದ್ರಣ ಆರ್ಟ್‌ವರ್ಕ್ ಫೈಲ್‌ಗಳು" },
    ],
  },
]

