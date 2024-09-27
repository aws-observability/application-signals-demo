FROM mcr.microsoft.com/dotnet/sdk:8.0
WORKDIR /app

COPY . .

RUN dotnet restore
RUN dotnet build
RUN dotnet publish -c Release -o out

ENV ASPNETCORE_ENVIRONMENT=Development

EXPOSE 8080

ENTRYPOINT [ "dotnet", "./out/PetClinic.PaymentService.dll" ]