import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";
import { RootShell, viewport } from "@/app/root-shell";

export { viewport };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const baseUrl = getSiteUrl();

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${baseUrl}/${l}`])),
        "x-default": `${baseUrl}/${routing.defaultLocale}`,
      },
    },
    openGraph: { title: t("ogTitle"), description: t("ogDescription"), type: "website" },
    twitter: { card: "summary", title: t("twitterTitle"), description: t("twitterDescription") },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <RootShell lang={locale}>
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </RootShell>
  );
}
