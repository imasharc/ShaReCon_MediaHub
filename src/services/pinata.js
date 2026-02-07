const JWT = import.meta.env.VITE_PINATA_JWT;

export async function uploadToIPFS(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${JWT}` },
        body: formData
    });

    if (!res.ok) throw new Error("Pinata Upload Failed");
    const data = await res.json();
    return data.IpfsHash; // Return the CID
}