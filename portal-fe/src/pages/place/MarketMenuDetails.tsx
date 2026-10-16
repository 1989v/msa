import type { GoodPriceShop, MarketEnglishFields, MarketTourMenu } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';

/** Sources describe the supplied data; TourAPI does not supply menu prices. */
export default function MarketMenuDetails({ store, lang }: {
  store: MarketEnglishFields & { items: string | null; category?: string | null; categorySub?: string | null; goodPrice?: GoodPriceShop | null; tourMenu?: MarketTourMenu | null };
  lang: PlaceLang;
}) {
  const en = lang === 'en';
  const menu = store.tourMenu;
  const first = en ? menu?.firstMenuEn || menu?.firstMenu : menu?.firstMenu;
  const treat = en ? menu?.treatMenuEn || menu?.treatMenu : menu?.treatMenu;
  return <>
    {store.goodPrice && <p className="place-market-source">{en ? 'Source: Ministry of the Interior and Safety · Good-price shops' : '출처: 행정안전부 착한가격업소'}</p>}
    {first && <p>{en ? 'Signature menu' : '대표 메뉴'}: {first}</p>}
    {treat && <p>{en ? 'Other menus' : '취급 메뉴'}: {treat}</p>}
    {(first || treat) && <p className="place-market-source">{en ? 'Source: Korea Tourism Organization TourAPI' : '출처: 한국관광공사 TourAPI'}</p>}
    {(store.items || (en && store.itemsEn)) && <p>{en ? store.itemsEn || store.items : store.items}</p>}
    {(store.categorySub || store.category || (en && store.categoryEn)) && <p>{en ? store.categoryEn || store.categorySub || store.category : store.categorySub || store.category}</p>}
  </>;
}
