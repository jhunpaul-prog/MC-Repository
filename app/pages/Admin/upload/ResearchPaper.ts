export interface ResearchPaper {
  id: string;
  title: string;
  department: string;
  abstract: string;
  fileUrl: string;
  privacy: 'Public' | 'Restricted';
  extractedText: string;
  uploadDate: string;
}
