This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Microsoft Sign-In Configuration

The login page uses Supabase OAuth with the `azure` provider and requests the
`email` scope. No Microsoft client secrets or Supabase service-role credentials
belong in client code.

Before Microsoft sign-in can work in a deployed environment:

1. In Microsoft Entra, register the SydIN web application.
2. Add the Supabase Azure callback URL shown in the Supabase provider settings
   as an allowed web redirect URI.
3. Create a client secret for the Entra application.
4. In Supabase Dashboard, enable the Azure provider and enter the Entra client
   ID and client secret.
5. Add every allowed SydIN post-auth URL to the Supabase Authentication redirect
   URL allow list, including local development and production dashboard URLs.

Google and Microsoft use the same existing SydIN `redirectTo` destination and
Supabase session handling. Enterprise SSO is intentionally not configured.

## Email Verification Codes

Email/password signup verifies new accounts with a numeric Supabase email OTP.
In the Supabase Auth email template for confirming signup, include the token
value (for example, `{{ .Token }}`) so the message sends the verification code
instead of relying only on a confirmation link. Keep email confirmation enabled
for the Supabase email provider.

The public SydIN email logo is available at:

`/email/sydin-logo.png`

Production email templates can reference:

`https://sydin.vercel.app/email/sydin-logo.png`
