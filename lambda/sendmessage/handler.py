import boto3
import os
import json
import logging
from botocore.exceptions import ClientError
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def send_message(apigw, connection_id, message_data):
    try:
        apigw.post_to_connection(
            ConnectionId=connection_id,
            Data=message_data.encode('utf-8')
        )
        return {"ConnectionId": connection_id, "Status": "Success"}
    except ClientError as e:
        logger.warning(f"Failed to send to {connection_id}: {e}")
        return {"ConnectionId": connection_id, "Status": "Failed"}

def lambda_handler(event, context):
    try:
        connections = table.scan()
        connection_items = connections.get('Items', [])
    except ClientError as e:
        logger.error(f"DynamoDB scan error: {e}")
        return {'statusCode': 500}

    try:
        message_data = json.loads(event['body'])['message']
    except (KeyError, json.JSONDecodeError) as e:
        logger.error(f"Invalid message format: {e}")
        return {'statusCode': 400}

    domain = event['requestContext']['domainName']
    stage = event['requestContext']['stage']
    endpoint = f"https://{domain}/{stage}"
    apigw = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint)
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [
            executor.submit(send_message, apigw, item['connectionId'], message_data)
            for item in connection_items
            if item.get('connectionId') != event['requestContext']['connectionId']
        ]

        for future in as_completed(futures):
            result = future.result()
            if result['Status'] != 'Success':
                logger.debug(f"Delivery failed: {result['ConnectionId']}")

    return {'statusCode': 200}