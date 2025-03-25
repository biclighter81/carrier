# Carrier Service - Observability prototype

This repository is a prototype for a carrier service that simulates the process of sending shipment requests to an external carrier and receiving shipment labels in return. The system is designed to demonstrate observability features, including logging, metrics, and tracing.

## Stack

- Typescript
- Node.js
- Express
- Redis
- BullMQ

### wms

`apps/wms`
Creates faked ShipmentRequests and sends them to the broker. It also receives ShipmentLabel objects from the internal carrier to save them in the database.

### broker

`apps/broker`
Gets lots of requests from wms and sends them to the desired internal carrier via a bullmq queue.

### carrier (internal)

`apps/carrier`
Receives requests from the broker and sends them to the desired external carrier via HTTP JSON Request.

### carrier (external)

`apps/carrier-mock`
Mocks the external carrier. It receives requests from the internal carrier and sends a ShipmentLabel object back.

### shared libraries

`packages/types`
Contains the types used in the system. It is a monorepo that can be used by all applications.

`packages/instrumentation`
Contains the instrumentation code for logging, metrics, and tracing. It is a monorepo that can be used by all applications.
