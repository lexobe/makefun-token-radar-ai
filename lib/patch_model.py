import re

with open('model.ts', 'r') as f:
    content = f.read()

# The new impliedValue function
new_function = """export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  
  // Caishen's Hyper-Growth Multiplier
  let growthMult = 1 + (growthPct / 100) * model.growth_weight;
  if (growthPct > 50) {
      growthMult += ((growthPct - 50) / 100) * 0.5; // Non-linear boost for hyper growth
  }

  // Caishen's Category Premium (Narrative)
  let categoryMult = 1.0;
  const cat = (protocol.category || "").toLowerCase();
  if (cat.includes("dex") || cat.includes("lending")) categoryMult = 1.1;
  else if (cat.includes("bridge") || cat.includes("yield")) categoryMult = 1.05;
  else if (cat.includes("ai") || cat.includes("depin")) categoryMult = 1.3;

  // Caishen's Chain Momentum Premium
  let chainMult = 1.0;
  const chainsStr = protocol.chains.join(" ").toLowerCase();
  if (chainsStr.includes("solana") || chainsStr.includes("base")) chainMult = 1.2;

  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  
  const base = protocol.tvl_usd * model.base_multiple;
  
  // Final Implied Value Calculation
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * categoryMult * chainMult));
  
  return { implied, growthPct, growthMult, maturityMult, age };
}"""

# Replace the old function
pattern = re.compile(r'export function impliedValue.*?return \{ implied, growthPct, growthMult, maturityMult, age \};\n\}', re.DOTALL)
content = re.sub(pattern, new_function, content)

with open('model.ts', 'w') as f:
    f.write(content)

print(">>> model.ts successfully patched with Caishen's Alpha parameters.")
