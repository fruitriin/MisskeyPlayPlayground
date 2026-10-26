// コードを deflate して URL の hash に入れる
function toBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
	const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
	return new Uint8Array(await res.arrayBuffer());
}

export async function encodeCode(code: string): Promise<string> {
	return toBase64Url(await pipe(new TextEncoder().encode(code), new CompressionStream('deflate-raw')));
}

export async function decodeCode(encoded: string): Promise<string> {
	return new TextDecoder().decode(await pipe(fromBase64Url(encoded), new DecompressionStream('deflate-raw')));
}
