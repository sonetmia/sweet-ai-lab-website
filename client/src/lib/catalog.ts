export const platforms = [
  "General",
  "Adobe Stock",
  "Freepik",
  "Shutterstock",
  "Vecteezy",
  "Depositphotos",
  "123RF",
  "Dreamstime",
] as const;

export const promptStyles = [
  "Original",
  "Kawaii Sticker",
  "Flat Vector",
  "Pixar 3D",
  "Cinematic",
  "Coloring Book",
  "B&W Vector",
  "Line Art",
] as const;

export const plans = {
  free: { name: "Free", credits: 10, price: "৳0", description: "A thoughtful starting point for testing the workflow." },
  pro: { name: "Pro", credits: 6000, price: "৳200", description: "For steady, repeatable contributor production." },
  max: { name: "Max", credits: 8000, price: "৳500", description: "For high-volume stock workflows and teams." },
} as const;
