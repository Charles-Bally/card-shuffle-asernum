export type Project = {
  id: string;
  index: string;
  name: string;
  category: string;
  description: string;
  cover: string;
  video: string;
  metric: { value: string; label: string };
  status: string;
  team: string[];
};

const img = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?q=85&w=${w}&auto=format&fit=crop`;

const face = (id: string) =>
  `https://images.unsplash.com/${id}?q=80&w=96&h=96&auto=format&fit=crop&crop=faces`;

const video = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;

export const projects: Project[] = [
  {
    id: "nala-pay",
    index: "01",
    name: "Nala Pay",
    category: "Infrastructure de paiement",
    description: "Encaissement omnicanal et routage intelligent pour l'Afrique de l'Ouest.",
    cover: img("photo-1556742049-0cfed4f6a45d", 1200),
    video: video(4919),
    metric: { value: "2,4 M", label: "transactions / jour" },
    status: "En production",
    team: [
      face("photo-1494790108377-be9c29b29330"),
      face("photo-1507003211169-0a1dd7228f2d"),
      face("photo-1534528741775-53994a69daeb"),
    ],
  },
  {
    id: "kori-wallet",
    index: "02",
    name: "Kori Wallet",
    category: "Application mobile",
    description: "Portefeuille multi-devises XOF avec cartes virtuelles instantanées.",
    cover: img("photo-1563013544-824ae1b704d3", 1200),
    video: video(4801),
    metric: { value: "310 k", label: "portefeuilles actifs" },
    status: "Bêta privée",
    team: [
      face("photo-1500648767791-00dcc994a43e"),
      face("photo-1539571696357-5a69c17a67c6"),
    ],
  },
  {
    id: "atlas-ledger",
    index: "03",
    name: "Atlas Ledger",
    category: "Plateforme web",
    description: "Trésorerie unifiée et réconciliation des flux en temps réel.",
    cover: img("photo-1551288049-bebda4e38f71", 1200),
    video: video(42664),
    metric: { value: "99,98 %", label: "de disponibilité" },
    status: "Design review",
    team: [
      face("photo-1517841905240-472988babdf9"),
      face("photo-1506794778202-cad84cf45f1d"),
      face("photo-1438761681033-6461ffad8d80"),
    ],
  },
];
