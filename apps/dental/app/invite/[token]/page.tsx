import { getTranslations } from 'next-intl/server';
import { InvitePageClient } from './InvitePageClient';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const t = await getTranslations('invite');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <InvitePageClient token={token} />
      </div>
    </div>
  );
}
