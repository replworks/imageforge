import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';

export type IdentityVerifier = (request: Request) => Promise<boolean>;

export function createIdentityVerifier(
  teamDomain: string,
  audience: string,
  keySet: JWTVerifyGetKey = createRemoteJWKSet(
    new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
  ),
): IdentityVerifier {
  const issuer = `https://${teamDomain}`;

  return async (request) => {
    const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!assertion) {
      return false;
    }

    try {
      await jwtVerify(assertion, keySet, {
        issuer,
        audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp'],
      });
      return true;
    } catch {
      return false;
    }
  };
}
