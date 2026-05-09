import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEO_CONFIG } from '@/utils/seoConfig';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  schema?: object;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonical,
  ogType = 'website',
  ogImage = '/og-image.png',
  schema
}) => {
  const fullTitle = title 
    ? `${title} | ${SEO_CONFIG.brandName} - ${SEO_CONFIG.location.city}`
    : `${SEO_CONFIG.brandName} | ${SEO_CONFIG.tagline}`;
  
  const fullDescription = description || SEO_CONFIG.description;
  const fullKeywords = keywords 
    ? [...keywords, ...SEO_CONFIG.keywords].join(', ')
    : SEO_CONFIG.keywords.join(', ');
  
  const siteUrl = SEO_CONFIG.websiteUrl;
  const currentUrl = canonical ? `${siteUrl}${canonical}` : siteUrl;

  // Default Medical Organization Schema
  const defaultSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "name": SEO_CONFIG.brandName,
    "url": siteUrl,
    "logo": `${siteUrl}/logo.png`,
    "description": SEO_CONFIG.description,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": SEO_CONFIG.location.city,
      "addressRegion": SEO_CONFIG.location.state,
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": SEO_CONFIG.location.geo.latitude,
      "longitude": SEO_CONFIG.location.geo.longitude
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-XXXXXXXXXX", // Should be dynamic
      "contactType": "customer service"
    }
  };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <meta name="keywords" content={fullKeywords} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />

      {/* Structured Data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(schema || defaultSchema)}
      </script>

      {/* Additional SEO Signals */}
      <meta name="geo.region" content="IN-AP" />
      <meta name="geo.placename" content={SEO_CONFIG.location.city} />
      <meta name="geo.position" content={`${SEO_CONFIG.location.geo.latitude};${SEO_CONFIG.location.geo.longitude}`} />
      <meta name="ICBM" content={`${SEO_CONFIG.location.geo.latitude}, ${SEO_CONFIG.location.geo.longitude}`} />
    </Helmet>
  );
};

export default SEO;
