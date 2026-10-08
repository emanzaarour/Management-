import './globals.css';

export const metadata = {
  title: 'MAPS Management Portal',
  description: 'Staff attendance, weekly schedules, program sessions and monthly timesheets',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
