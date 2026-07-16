import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const checks = [
  "Najčastejšie poruchy konkrétneho modelu",
  "Odhadované ceny opráv v lokálnych servisoch",
  "Jasné porovnanie ceny záruky a reálneho rizika",
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M4 10h11M11 5l5 5-5 5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m4 10 4 4 8-9" />
    </svg>
  );
}

function App() {
  return (
    <main>
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Hlavná navigácia">
        <a className="brand" href="#top" aria-label="Warranty Advisor domov">
          <span className="brand-mark">W</span>
          <span>Warranty Advisor</span>
        </a>
        <a className="nav-link" href="#ako-to-funguje">
          Ako to funguje
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Rozhodnutie pred podpisom</p>
          <h1>
            Záruka alebo
            <span> zbytočný výdavok?</span>
          </h1>
          <p className="lede">
            Zistite reálne riziko poruchy a cenu opravy skôr, ako zaplatíte za
            predĺženú záruku.
          </p>
          <a className="primary-button" href="mailto:ahoj@warrantyadvisor.sk">
            Chcem skorý prístup
            <ArrowIcon />
          </a>
          <p className="button-note">Bezplatne počas testovacej prevádzky.</p>
        </div>

        <div className="report-wrap" aria-label="Ukážka hodnotenia záruky">
          <div className="orbit orbit-one" aria-hidden="true" />
          <div className="orbit orbit-two" aria-hidden="true" />
          <article className="report-card">
            <div className="report-header">
              <div>
                <p>Hodnotenie ponuky</p>
                <h2>Práčka Bosch WAN28260BY</h2>
              </div>
              <span className="status">Analyzované</span>
            </div>
            <div className="verdict">
              <div className="score-ring">
                <strong>34</strong>
                <span>/ 100</span>
              </div>
              <div>
                <p className="verdict-label">Odporúčanie</p>
                <h3>Záruka sa skôr neoplatí</h3>
                <p>Očakávaná oprava stojí menej než ponúkané krytie.</p>
              </div>
            </div>
            <div className="price-row">
              <div>
                <span>Cena záruky</span>
                <strong>119 €</strong>
              </div>
              <div>
                <span>Bežná oprava</span>
                <strong>72–96 €</strong>
              </div>
            </div>
            <div className="risk-line">
              <span>Riziko poruchy do 5 rokov</span>
              <strong>18,7 %</strong>
            </div>
            <div className="risk-track" aria-hidden="true">
              <span />
            </div>
          </article>
        </div>
      </section>

      <section className="method" id="ako-to-funguje">
        <div className="method-heading">
          <p className="eyebrow">Menej odhadov, viac faktov</p>
          <h2>Jedna ponuka. Tri dôležité odpovede.</h2>
        </div>
        <ul>
          {checks.map((check, index) => (
            <li key={check}>
              <span className="number">0{index + 1}</span>
              <span className="check-icon">
                <CheckIcon />
              </span>
              <p>{check}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
