export const metadata = {
  title: 'Transcription Juridique Administrative',
  description: 'Outil de transcription et de mise en forme de jugements administratifs marocains',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar">
      <body style={{ margin: 0, backgroundColor: '#f1f5f9' }}>{children}</body>
    </html>
  )
}