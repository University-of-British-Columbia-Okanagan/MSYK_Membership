export default function AboutHero() {
  return (
    <section
      className="relative h-[300px] flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/path-to-about-banner.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <h1 className="relative text-white text-5xl font-bold">Get Involved</h1>
    </section>
  );
}
