export const PEER_ORIGIN = 'https://rank.1989v.com';
export const peerLoginHref = () => `https://1989v.com/login?next=${encodeURIComponent(`${PEER_ORIGIN}${window.location.pathname}${window.location.search}`)}`;
