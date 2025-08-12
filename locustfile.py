from locust import HttpUser, task, constant_throughput

class Shipment(HttpUser):
    # Each user: 1 request per second
    wait_time = constant_throughput(1)

    @task
    def shipment(self):
        self.client.post("/shipment/dispatch")
    @task
    def nginx(self):
        self.client.get("/")