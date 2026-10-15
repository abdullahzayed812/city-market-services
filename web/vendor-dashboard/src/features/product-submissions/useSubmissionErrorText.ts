import { useTranslation } from "react-i18next";

// API error code -> readable text (falls back to the generic message)
export const useSubmissionErrorText = () => {
  const { t } = useTranslation();
  return (error: any) => {
    const code = error?.response?.data?.message;
    return code ? t(`product_submissions.errors.${code}`, { defaultValue: t("product_submissions.errors.generic") }) : t("product_submissions.errors.generic");
  };
};
