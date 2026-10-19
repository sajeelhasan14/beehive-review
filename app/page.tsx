import { redirect } from 'next/navigation';

// The bare site address has nothing of its own; send people to sign in.
export default function Home() {
  redirect('/login');
}
