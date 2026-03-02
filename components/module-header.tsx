"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { moduleDefinitions } from "@/lib/modules";

export function ModuleHeader() {
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(moduleDefinitions[0]?.id ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenModuleId(null);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={rootRef} className="card module-shell">
      <nav aria-label="Modulos do sistema">
        <ul className="module-list">
          {moduleDefinitions.map((module) => {
            const isOpen = openModuleId === module.id;
            const isSelected = selectedModuleId === module.id;

            return (
              <li key={module.id} className="module-item">
                <button
                  type="button"
                  className={`module-trigger ${isSelected ? "active" : ""}`}
                  onClick={() => {
                    setSelectedModuleId(module.id);
                    setOpenModuleId((current) => (current === module.id ? null : module.id));
                  }}
                >
                  {module.label}
                  <span className="module-caret">v</span>
                </button>

                {isOpen && (
                  <div className="module-dropdown" role="menu">
                    {module.links.map((link) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="module-link"
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setOpenModuleId(null);
                        }}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
