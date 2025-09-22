import os
import boto3

TABLE_NAME = os.environ.get("TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    table.delete_item(Key={"connectionId": connection_id})
    return {
        "statusCode": 200,
        "body": "Disconnected"
    }
