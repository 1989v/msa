export const cafeDrinkImages = {
  americano: '/cafe/drinks/americano.webp',
  'cafe-latte': '/cafe/drinks/cafe-latte.webp',
  'vanilla-latte': '/cafe/drinks/vanilla-latte.webp',
  'cafe-mocha': '/cafe/drinks/cafe-mocha.webp',
  'caramel-macchiato': '/cafe/drinks/caramel-macchiato.webp',
  'sweet-potato-latte': '/cafe/drinks/sweet-potato-latte.webp',
  'matcha-latte': '/cafe/drinks/matcha-latte.webp',
  'strawberry-latte': '/cafe/drinks/strawberry-latte.webp',
  'iced-tea': '/cafe/drinks/iced-tea.webp',
  'lemon-ade': '/cafe/drinks/lemon-ade.webp',
  frappe: '/cafe/drinks/frappe.webp',
  'orange-juice': '/cafe/drinks/orange-juice.webp',
} as const;

export function cafeDrinkImage(name: string, group = ''): string {
  if (name.includes('딸기')) return cafeDrinkImages['strawberry-latte'];
  // API groups already distinguish recipes (including corrected groups); names fill in home tiles.
  const category = group || name;
  if (/아메리카노|에스프레소|콜드브루/.test(category)) return cafeDrinkImages.americano;
  if (/바닐라/.test(category)) return cafeDrinkImages['vanilla-latte'];
  if (/카페모카|모카|초코/.test(category)) return cafeDrinkImages['cafe-mocha'];
  if (/카라멜.*마끼아또/.test(category)) return cafeDrinkImages['caramel-macchiato'];
  if (/고구마/.test(category)) return cafeDrinkImages['sweet-potato-latte'];
  if (/말차|녹차/.test(category)) return cafeDrinkImages['matcha-latte'];
  if (/밀크티|우유|요거트/.test(category)) return cafeDrinkImages['cafe-latte'];
  if (/스무디|프라페/.test(category)) return cafeDrinkImages.frappe;
  if (/에이드|탄산음료/.test(category)) return cafeDrinkImages['lemon-ade'];
  if (/주스/.test(category)) return cafeDrinkImages['orange-juice'];
  if (/라떼|카푸치노/.test(category)) return cafeDrinkImages['cafe-latte'];
  if (/티/.test(category)) return cafeDrinkImages['iced-tea'];
  return cafeDrinkImages['cafe-latte'];
}

