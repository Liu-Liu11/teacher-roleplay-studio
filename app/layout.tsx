import type { Metadata } from 'next';
import './globals.css';
import { LocaleHtmlLang } from '@/components/LocaleHtmlLang';

// Bilingual title/description: visible in tab and sharing previews for both audiences.
// The <html lang> is set to a neutral "en" at SSR time and then updated client-side
// to match the teacher's chosen locale (see LocaleHtmlLang).
export const metadata: Metadata = {
  title: 'TeacherRoleplayStudio · 教师角色扮演工作台',
  description:
    'Conversationally design multi-agent roleplay teaching scenarios · 对话式创建多智能体角色扮演教学场景',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LocaleHtmlLang />
        {children}
      </body>
    </html>
  );
}
