from locust import HttpUser, task

class Shipment(HttpUser):
    @task
    def Shipment(self):
        self.client.post('/shipment/dispatch')