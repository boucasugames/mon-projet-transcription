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

    // 1. Étape Whisper avec ancrage strict
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
    let rawText = whisperData.text;

    // 2. Correction phonétique stricte avec interdiction absolue d'ajouter des noms ou signatures
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
            content: `أنت مدقق إملائي صوتي دقيق جداً لأحكام المحاكم المغربية. 
مهمتك: تصحيح الأخطاء النطقية فقط (مثل: "قبور" -> "قبول"، "الطعام" -> "الطلبات"، "الصادر" الخاطئة في نهاية الحكم إلى "الصائر").

شروط صارمة جداً:
1. ممنوع منعاً باتاً إضافة أي توقيعات، أو أسماء أشخاص، أو عبارات خارجية (مثل أسماء مترجمين أو جهات غير موجودة في النص).
2. لا تضف أي كلمات من عندك، حافظ على نص المستخدم بحذافيره بعد تصحيح أخطائه الإملائية والصوتية فقط.
3. أعطِ النص المصحح مباشرة دون أي مقدمات أو إضافات.`
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
      return NextResponse.json({ error: `Erreur AI: ${errChat.error?.message}` }, { status: chatRes.status });
    }

    const chatData = await chatRes.json();
    let correctedText = chatData.choices[0].message.content;

    // Sécurité supplémentaire : s'assurer qu'aucune "traduction" ou nom parasite n'apparaît à la fin
    correctedText = correctedText.replace(/ترجمة.*$/gm, '').trim();

    return NextResponse.json({ text: correctedText });

  } catch (error: any) {
    return NextResponse.json({ error: `Erreur serveur: ${error?.message}` }, { status: 500 });
  }
}