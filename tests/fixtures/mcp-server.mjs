import { createInterface } from 'node:readline';
const reader = createInterface({ input: process.stdin });
reader.on('line', line => {
  const request = JSON.parse(line);
  if (!('id' in request)) return;
  let result;
  switch (request.method) {
    case 'initialize': result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } }; break;
    case 'tools/list': result = request.params?.cursor ? { tools: [{ name: 'failure', inputSchema: { type: 'object' } }] } : { tools: [{ name: 'echo', inputSchema: { type: 'object' } }], nextCursor: 'second' }; break;
    case 'tools/call':
      if (request.params.name === 'hang') return;
      result = { content: [{ type: 'text', text: request.params.name === 'pid' ? String(process.pid) : JSON.stringify(request.params.arguments) }], isError: request.params.name === 'failure' }; break;
    default: result = {};
  }
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`);
});
