import React from 'react';

interface HelmetProps {
  title: string;
  description?: string;
}

export function Helmet({ title, description }: HelmetProps) {
  // Update document title
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | Requisor` : 'Requisor';
    
    // If description is provided, update meta description
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      const previousDescription = metaDescription?.getAttribute('content');
      
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      } else {
        const newMeta = document.createElement('meta');
        newMeta.name = 'description';
        newMeta.content = description;
        document.head.appendChild(newMeta);
      }
      
      return () => {
        document.title = previousTitle;
        
        // Restore previous description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && previousDescription) {
          metaDesc.setAttribute('content', previousDescription);
        }
      };
    }
    
    return () => {
      document.title = previousTitle;
    };
  }, [title, description]);
  
  // This component doesn't render anything
  return null;
}