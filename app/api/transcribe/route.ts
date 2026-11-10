import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('file') as Blob;
    const legalTopic = (formData.get('topic') as string) || 'expropriation';

    if (!audioBlob) {
      return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    const file = new File([buffer], 'recording.webm', { type: 'audio/webm' });

    let whisperPrompt = `حكم باسم جلالة الملك وطبقاً للقانون، المحكمة الإدارية، محكمة الاستئناف الإدارية، دعوى إلغاء القرار الإداري، المسؤولية الإدارية، مفوض الملك للدفاع عن القانون والحق.`;
    
    if (legalTopic === 'expropriation') {
      whisperPrompt = `نزع الملكية من أجل المنفعة العامة، القانون رقم 7.81، المحكمة الإدارية، إيداع التعويض الاحتياطي، الإذن بالحيازة، نقل الملكية، لجنة التقييم، الوكيل القضائي للمملكة، الخبير القضائي.`;
    }

    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('language', 'ar');
    groqFormData.append('prompt', whisperPrompt);

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: groqFormData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json();
      return NextResponse.json({ error: `Groq Whisper: ${err.error?.message}` }, { status: whisperRes.status });
    }

    const whisperData = await whisperRes.json();
    const rawText = whisperData.text;

  // 2. Correction stricte sans AUCUNE invention ni ajout
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
            content: `أنت مدقق إملائي وقانوني بحت لتسجيلات المحاكم المغربية. 
مهمتك الوحيدة هي تصحيح الأخطاء النطقية والإملائية فقط في النص المنسوخ من الصوت، وجعل الكلمات القانونية دقيقة (مثل نزع الملكية، علنيا حضوريا، الصائر، إلخ).
قواعد صارمة جداً:
1. ممنوع منعاً باتاً إضافة أي فقرات، أو وقائع، أو توقيعات، أو عناوين (مثل "الوقائع"، "المقرر"، "الحكم") لم تذكر في الصوت الأصلي.
2. لا تحذف أي كلمة ذكرها المستخدم، ولا تقم بتأليف أسماء أو تواريخ أو مبالغ جديدة.
3. التزم حرفياً بنص المتحدث مع تصحيح إملائه فقط ليكون جاهزاً للنسخ.`
          },
          {
            role: 'user',
            content: rawText
          }
        ],
        temperature: 0.0
      }),
    });

    if (!chatRes.ok) {
      const errChat = await chatRes.json();
      return NextResponse.json({ error: `Groq AI: ${errChat.error?.message}` }, { status: chatRes.status });
    }

    const chatData = await chatRes.json();
    const correctedText = chatData.choices[0].message.content;

    return NextResponse.json({ text: correctedText });

  } catch (error: any) {
    return NextResponse.json({ error: `Erreur serveur: ${error?.message}` }, { status: 500 });
  }
}