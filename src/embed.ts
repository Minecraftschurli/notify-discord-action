export type EmbedFooter = {
  text: string; // max length 2048
  icon_url?: string;
};

export type EmbedImage = {
  url: string;
};

export type EmbedThumbnail = {
  url: string;
};

export type EmbedAuthor = {
  name: string; // max length 256
  url?: string;
  icon_url?: string;
};

export type EmbedField = {
  name: string; // max length 256
  value: string; // max length 1024
  inline?: boolean;
};

export type Embed = {
  title?: string; // max length 256
  description?: string; // max length 4096
  url?: string;
  timestamp?: string;
  color?: number | string;
  footer?: EmbedFooter;
  image?: EmbedImage;
  thumbnail?: EmbedThumbnail;
  author?: EmbedAuthor;
  fields?: EmbedField[]; // max 25
};
