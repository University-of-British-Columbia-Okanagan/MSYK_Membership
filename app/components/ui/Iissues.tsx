interface Screenshot {
  id: string;
  url: string;
}

interface ReportedBy {
  id: string;
  email: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  screenshots: Screenshot[];
  reportedBy: ReportedBy;
  createdAt: string;
}