'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [legalTopic, setLegalTopic] = useState('expropriation');
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Accès au microphone refusé ou non disponible.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleTranscribe = async () => {
    if (!audioBlob) return;

    setLoading(true);
    setTranscription('');

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('topic', legalTopic);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        setTranscription(`Erreur : ${data.error}`);
      } else {
        setTranscription(data.text);
      }
    } catch (err) {
      setTranscription('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    alert('Texte copié dans le presse-papier !');
  };

  return (
    <main style={{ maxWidth: '700px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#1e3a8a', textAlign: 'center' }}>محول الصوت إلى أحكام قضائية إدارية</h2>
      <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>المحكمة الإدارية - نزع الملكية والمنازعات الإدارية</p>

      {/* Choix de la spécialité */}
      <div style={{ margin: '20px 0' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>المجال القانوني / المسطرة :</label>
        <select 
          value={legalTopic} 
          onChange={(e) => setLegalTopic(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
        >
          <option value="expropriation">نزع الملكية من أجل المنفعة العامة (القانون 7.81)</option>
          <option value="general">منازعات إدارية عامة / تجاوز السلطة</option>
        </select>
      </div>

      {/* Boutons d'enregistrement */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '20px 0' }}>
        {!isRecording ? (
          <button onClick={startRecording} style={{ padding: '12px 24px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            🔴 تسجيل صوتي
          </button>
        ) : (
          <button onClick={stopRecording} style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            ⏹️ إيقاف التسجيل
          </button>
        )}
      </div>

      {/* Lecteur audio et bouton de traitement */}
      {audioUrl && (
        <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'center', margin: '20px 0' }}>
          <audio src={audioUrl} controls style={{ width: '100%', marginBottom: '10px' }} />
          <button 
            onClick={handleTranscribe} 
            disabled={loading}
            style={{ width: '100%', padding: '12px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
          >
            {loading ? 'جاري المعالجة والتدقيق القضائي...' : 'تحويل وتدقيق قانوني'}
          </button>
        </div>
      )}

      {/* Résultat (Arabe - RTL) */}
      {transcription && (
        <div style={{ marginTop: '25px', padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'rtl', textAlign: 'right', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, color: '#1e293b' }}>النص القضائي المدقق:</h3>
            <button onClick={copyToClipboard} style={{ padding: '6px 12px', background: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              نسخ النص
            </button>
          </div>
          <p style={{ fontSize: '1.15rem', lineHeight: '2', whiteSpace: 'pre-wrap', color: '#334155' }}>{transcription}</p>
        </div>
      )}
    </main>
  );
}