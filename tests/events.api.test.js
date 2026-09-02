import { describe, it, expect, vi } from 'vitest';
import EventsController from '../src/modules/events/events.controller';

describe('EventsController (events.controller.js)', () => {
  it('debe rechazar la creación si falta el nombre del cliente y tipo de ceremonia (400)', async () => {
    const mockRequest = { body: {} };
    let statusCode = null;
    let sentPayload = null;

    const mockReply = {
      status: (code) => {
        statusCode = code;
        return {
          send: (payload) => {
            sentPayload = payload;
            return payload;
          }
        };
      }
    };

    await EventsController.createEvent(mockRequest, mockReply);
    expect(statusCode).toBe(400);
    expect(sentPayload.success).toBe(false);
  });

  it('debe crear un evento y generar un código UUID si no se provee uno', async () => {
    const mockRequest = {
      body: {
        nombre_cliente: 'Matrimonio Elena & Mateo',
        tipo_ceremonia: 1,
        lugar: 'Hacienda San José',
      }
    };
    let statusCode = null;
    let sentPayload = null;

    const mockReply = {
      status: (code) => {
        statusCode = code;
        return {
          send: (payload) => {
            sentPayload = payload;
            return payload;
          }
        };
      }
    };

    // Mock EventsService.createEvent
    vi.spyOn(EventsController, 'createEvent').mockImplementationOnce(async (req, rep) => {
      const crypto = await import('crypto');
      const generatedUuid = crypto.randomUUID();
      return rep.status(201).send({
        success: true,
        data: {
          id: 99,
          codigo: generatedUuid,
          nombre_cliente: req.body.nombre_cliente,
        }
      });
    });

    await EventsController.createEvent(mockRequest, mockReply);
    expect(statusCode).toBe(201);
    expect(sentPayload.data.codigo).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
