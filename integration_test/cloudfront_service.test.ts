import fetch from 'node-fetch';
describe('Integration test', () => {
  test('200 Response from CloudFront Distribution', async () => {
    const url = process.env.CLOUDFRONT_URL ? `https://${process.env.CLOUDFRONT_URL}/test.html` : 'No URL in env';
    console.log('CloudFront URL =>', url);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Request failed ${response.statusText}`);
      }
      const body = await response.text();
      console.log('Response body =>', body);

      expect(response.status).toEqual(200);
    } catch (err) {
      console.log('ERROR: ', err);
      throw err;
    }
  });
});
