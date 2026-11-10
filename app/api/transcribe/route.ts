import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('file') as Blob;
    const legalTopic = (formData.get('topic') as string) || 'general';

    if (!audioBlob) {
      return NextResponse.json({ error: 'Fichier audio manquant' }, { status: 400 });
    }

    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    const file = new File([buffer], 'recording.webm', { type: 'audio/webm' });

    // Dictionnaire d'ancrage pour orienter la détection phonétique de Whisper (sans réécrire le texte)
    let whisperPrompt = `باسم جلالة الملك وطبقا للقانون، حكمت المحكمة علنيا ابتدائيا وحضوريا وبمثابة حضوري، في الشكل، في الموضوع، إلغاء القرار الصادر عن رئيس جماعة وجدة، رفض باقي الطلب، ترتيب الآثار القانونية على ذلك، الصائر، المحكمة الإدارية، نزع الملكية، المنفعة العامة.`;

    const groqFormData = new FormData();
    groqFormData.append('file', file);
    groqFormData.append('model', 'whisper-large-v3');
    groqFormData.append('language', 'ar');
    groqFormData.append('prompt', whisperPrompt);
    groqFormData.append('temperature', '0.0'); // 0.0 force la précision mot à mot stricte

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

    // Retour direct de la transcription Whisper exacte (sans passage par un LLM répartiteur)
    return NextResponse.json({ text: whisperData.text });

  } catch (error: any) {
    return NextResponse.json({ error: `Erreur serveur: ${error?.message}` }, { status: 500 });
  }
}