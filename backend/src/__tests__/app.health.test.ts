describe('app health', () => {
  it('returns service status on GET /health', async () => {
    const response = await fetch('http://127.0.0.1:3002/health');
    const body = await response.json() as { status: string; timestamp: string };

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        status: 'ok',
      }),
    );
    expect(typeof body.timestamp).toBe('string');
  });
});
