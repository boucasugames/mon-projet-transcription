import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('file') as Blob;

    if (!audioBlob) {
      return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    const file = new File([buffer], 'recording.webm', { type: 'audio/webm' });

    // 1. Étape Whisper avec le lexique administratif marocain
    let whisperPrompt = `باسم جلالة الملك وطبقا للقانون، حكمت المحكمة علنيا ابتدائيا وحضوريا وبمثابة حضوري، في الشكل، بقبول الطعن، في الموضوع، بإلغاء القرار الصادر عن رئيس جماعة وجدة، برفض طلب الشركة الطاعنة، الرامي إلى تغيير طبيعة النشاط جزئيا، موضوع الرخصة رقم 1205، بتاريخ 06 يوليوز 2025، مع ترتيب الآثار القانونية على ذلك، ورفض باقي الطلبات، الصائر.`;

    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('language', 'ar');
    groqFormData.append('prompt', whisperPrompt);
    groqFormData.append('temperature', '0.0');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: groqFormData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json();
      return NextResponse.json({ error: `Erreur Whisper: ${err.error?.message}` }, { status: whisperRes.status });
    }

    const whisperData = await whisperRes.json();
    const rawText = whisperData.text;

    // 2. Étape de correction phonétique stricte (Sans réécriture ni invention)
    const chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `أنت مدقق إملائي صوتي خاص بأحكام المحاكم المغربية. 
مهمتك الوحيدة: تصحيح الأخطاء النطقية والإملائية البحتة التي يرتكبها برنامج النسخ الصوتي (مثل تحويل "قبور" إلى "قبول"، "الطعام" إلى "الطلبات"، "بفرض" إلى "برفض"، "اسمي" إلى "باسم").

شروط صارمة جداً:
1. لا تقم أبداً بإضافة أي كلمات أو جمل أو فقرات أو توقيعات لم تذكر في النص الأصلي.
2. لا تقم بحذف أي كلمة ذكرها المستخدم.
3. حافظ على نفس الكلمات ونفس الترتيب تماماً، فقط صحح الكلمات المكتوبة خطأً نتيجة التشابه الصوتي (الكلمات المعوجة إملائياً أو المصطلحات القضائية المشوهة).
4. أرجع النص المصحح إملائياً فقط ودون أي مقدمات.`
          },
          {
            role: 'user',
            content: rawText
          }
        ],
        temperature: 0.05 // Température quasi-nulle pour interdire toute invention créative
      }),
    });

    if (!chatRes.ok) {
      const errChat = await chatRes.json();
      return NextResponse.json({ error: `Erreur AI: ${errChat.error?.message}` }, { status: chatRes.status });
    }

    const chatData = await chatRes.json();
    const correctedText = chatData.choices[0].message.content;

    return NextResponse.json({ text: correctedText });

  } catch (error: any) {
    return NextResponse.json({ error: `Erreur serveur: ${error?.message}` }, { status: 500 });
  }
}