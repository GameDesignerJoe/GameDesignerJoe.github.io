import React from 'react';
import { ContentTypeBase } from '../../types/ContentTypes';

interface ContentTypePanelProps {
  onContentTypeChange: (newContentTypes: ContentTypeBase[]) => void;
}

export const ContentTypePanel: React.FC<ContentTypePanelProps> = ({
  onContentTypeChange
}) => {
  return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #3a3a3a' }}>
      <h3 style={{ margin: 0, padding: '0 0 10px 0' }}>Content Types</h3>
      {/* Content type management UI will go here */}
    </div>
  );
};
