import copy from "../content/copy";

export default function Footer() {
  return (
    <footer className="bg-charcoal text-chalk mt-24">
      <div className="max-w-6xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-3">
        <div>
          <div className="font-display text-2xl tracking-widest2 mb-3">
            {copy.brand.name}
            {/* <span className="text-gold">.</span> */}
          </div>
          <p className="text-chalk/70 text-sm leading-relaxed max-w-xs">{copy.footer.about}</p>
        </div>

        <div>
          <h4 className="font-display text-lg tracking-wide text-gold mb-3">
            {copy.footer.shopHeading}
          </h4>
          <ul className="space-y-2 text-sm text-chalk/70">
            <li>Home Kits</li>
            <li>Away Kits</li>
            <li>Retro Shirts</li>
            <li>Goalkeeper Jerseys</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg tracking-wide text-gold mb-3">
            {copy.footer.helpHeading}
          </h4>
          <ul className="space-y-2 text-sm text-chalk/70">
            {copy.footer.helpLinks.map((link) => (
              <li key={link}>{link}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-chalk/10 py-6 text-center text-xs text-chalk/50">
        {copy.footer.copyright}
      </div>
    </footer>
  );
}
