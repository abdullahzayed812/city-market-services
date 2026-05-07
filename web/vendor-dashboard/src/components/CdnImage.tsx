import React from "react";

interface CdnImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | undefined;
  fallback?: React.ReactNode;
}

const CdnImage: React.FC<CdnImageProps> = ({ src, fallback, alt, ...props }) => {
  if (!src) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} {...props} />;
};

export default CdnImage;
