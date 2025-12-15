import { redirect } from 'next/navigation';

/**
 * Profile page has been consolidated with Settings > Account
 * Redirecting to /settings/account
 */
export default function ProfilePage() {
  redirect('/settings/account');
}